# Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim - Research

**Researched:** 2026-06-27
**Domain:** React chat-surface (frontend-led) + cross-provider streaming-pipeline evidence (TDP-02)
**Confidence:** HIGH (all three unknowns resolved against real code + the npm registry + the streaming pipeline; one TDP-02 sub-question stays a live-Redis verify-at-execution item, flagged honestly)

## Summary

Phase 128 is a **frontend-led, G-2-sketch-locked** chat-surface phase. The design is settled (sketches 048-A / 049-A / 050-A, MANIFEST decisions 38-40); research is HOW-to-build-faithfully plus three evidence unknowns. All three resolved with code-level certainty:

1. **TDP-02 (the #1 target):** `tc.args.description` is **NOT** already populated during the `preparing` window — the CONTEXT.md assertion "already present in the tool-call args" is **PARTLY WRONG** and must be corrected for the planner. Traced the full pipeline: every provider (native Anthropic + Google AND the OpenAI-compat path for openai/deepseek/moonshot/zhipu/minimax/openrouter/ollama) streams tool args incrementally as **raw partial-JSON strings** via the canonical `tool_args_progress` SSE event (`args_so_far` 5KB-tail + `code_so_far` full cumulative), but the **parsed** `args` dict only lands at `tool_start`. The frontend stores those strings in `tc.argsCodeText`/`tc.argsBytesStreamed` and leaves `tc.args = {}` until `onToolStart`. **Therefore TDP-02 needs a small frontend change** — parse `description` out of the partial-JSON `argsCodeText` during preparing (no backend change needed; the bytes are already on the wire). Verdict per provider below.

2. **CTC-01 / D-08 (`@lobehub/icons`):** **VERIFIED on the npm registry** — v5.10.0, MIT, maintained by the lobehub org (official repo, 7 maintainers, published 2026-06-16), slopcheck `[OK]`. Ships named exports for **every** provider we need (OpenAI, Anthropic/Claude, Gemini/Google, DeepSeek, Moonshot/Kimi, Zhipu/ChatGLM, Minimax, OpenRouter, **Ollama**, **LmStudio**). `sideEffects: false` + ESM `module` entry → fully tree-shakeable under Vite 8; ~10-18KB gz for 9 marks. **One gotcha:** use the `.Color`/`.Mono` sub-components (pure SVG, ZERO deps) — NOT `.Avatar` (drags `antd` + `antd-style` via `peerDependencies`).

3. **Canonical provider key set (Unknown #3):** `message.provider` is the verbatim `runs.provider` value (`threads.py:292`) = `MODEL_CAPABILITIES[model]["provider"]` (`config.py`). The exact strings: **`openai` · `anthropic` · `google` · `deepseek` · `moonshot` · `zhipu` · `minimax` · `openrouter` · `ollama` · `lmstudio`** (+ possible `unknown`). **GLM is keyed `zhipu` (not "glm"); Kimi is keyed `moonshot` (not "kimi").** This is the load-bearing fact for a correct, total logo map.

**Primary recommendation:** Build a single shared `frontend/src/lib/providerLogo.tsx` helper (the D-05 micro-extraction) exporting (a) `providerLogo(provider)` → the right `@lobehub/icons` `.Color`/`.Mono` component keyed off the exact provider strings with the locked fallback, and (b) a `preparingDescription(tc)` helper that extracts `description` from `tc.args.description ?? parsePartialJsonDescription(tc.argsCodeText)`. Both `RunCard.tsx` and `ToolCallPanel.tsx` consume it. Sequence CTC-01/CTC-02/TDP-02 first, prove the live native-7+OR scoreboard (D-06), then delete `StickyTimerBar` last (CTC-03, D-07). CTC-04 is independent and contained to the user branch of `MessageItem.tsx`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-08 — verbatim)

- **D-01 (CTC-01 / CTC-02 / TDP-02 — sketch 048-A):** Unified cross-provider tool card. The brand-pulse `Bot` dot (`RunCard.tsx:280/287`) → the provider's REAL official logo per-provider on a faint per-provider tinted backing; the `brandPulse` ring stays while streaming. `tc.args.description` surfaces DURING the `preparing` window, before `tool_start`. The card reads byte-identically across all providers — only the logo differs. Already-wired (no flag): `message.provider` / `message.model` (the `{provider} · {model} · turn N` sub at `RunCard.tsx:246`), `tc.args.description`, `RunStatusStrip`.
- **D-02 (CTC-03 — sketch 049-A):** DELETE `StickyTimerBar` (`ChatArea.tsx:533-585`, the 076.1 D-03 bar) + its mount (`ChatArea.tsx:517-523`). Pure subtraction, **NO net-new wire** — keep the existing `showJumpToLive = !isPinned && isStreaming` floating chip. The header `RunStatusStrip` (in-view) + the `MessageList` floating "↓ Jump to live" chip (scroll-away) remain the ONLY two status homes. (Sketch B rejected as imperceptible — documented FALLBACK only.)
- **D-03 (CTC-04 — sketch 050-A):** Long USER prompt → `-webkit-line-clamp:7` preview + a fade **matched to the violet end of the bubble's 135° gradient** (not the page bg) + an inline "Read more"/"Show less" chip (`MessageItem.tsx:205-217`). SHORT prompts render UNCHANGED; right-alignment, `rounded-br-md` tail, `max-w-[70%]`, `pre-wrap`+`break-words`, the `User` avatar all preserved. **USER prompts ONLY** — do NOT clamp the assistant branch. Cheapest honest impl = always-render the clamp container, reveal the fade + Read-more only when `scrollHeight > clientHeight`.
- **D-04 (reported-bug folding):** Fold the **TDP-02 description slice** of `setting-up-agent-hides-model-activity`. Fold `BUG-260610-01`'s **timer-reseed** fix **ONLY IF** the planner confirms the reseed is in the same canonical Deep `RunStatusStrip` that 128 makes the sole timer (vs the 095.1-fixed Deep run-card, vs the harness/workflow run strip = Phase 127's surface). If different → leave open. Banner-honesty + title-gen + dup-avatar + BUG-260609-02 are NOT folded.
- **D-05 (G-5 audit):** PROCEED — no refactor-first phase. Surgical + net-subtractive. **Required micro-extraction:** put the `message.provider → logo` map AND the preparing-description logic in ONE shared helper (e.g. `providerLogo()` + a small tool-card-header helper) so `RunCard` and `ToolCallPanel` do not each grow duplicate copies.
- **D-06 (cross-provider proof bar + TDP-02 fallback):** The "CTC-02 holds" gate is a **LIVE SC#10 run across the full native-7 + OpenRouter**, NOT static screenshots, NOT big-4 only. Confirm the card carries {status · elapsed · step/file counts · description} on each. **TDP-02 honest fallback:** show `tc.args.description` only WHEN present; when absent, a quiet generic `Preparing {tool}…` — never fabricate. The card always renders (logo + status); the description is additive. Provider-docs-first: confirm per-provider whether the description field is populated in the preparing window (cross-check via the `run:{run_id}` Redis stream).
- **D-07 (sequencing):** CTC-03 (`StickyTimerBar` deletion) is the **LAST plan**, gated on the D-06 live cross-provider proof passing.
- **D-08 (logo dependency):** Ship logos via the **`@lobehub/icons` npm package** (maintained, tree-shakeable, MIT). NOT vendored SVGs. **Fallback rule (locked):** OpenRouter → the OpenRouter mark (do NOT unwrap to the routed model's brand); Ollama → the Ollama mark; LM Studio / OpenAI-compatible / unknown → keep today's brand-pulse `Bot` dot. The `brandPulse` ring stays while streaming in every case. The `048/logos/` SVGs drop to reference only.

### Claude's Discretion
- Clamp threshold for CTC-04 (line-count vs char-count vs overflow-detect) — D-03 records overflow-detect as default; planner may pick the cleanest equivalent.
- The exact shape/name of the D-05 shared header helper.

### Deferred Ideas (OUT OF SCOPE)
- `setting-up-agent-hides-model-activity` banner-honesty (cause b) + title-gen-async (cause c) — a dedicated "run legibility & latency" phase. TDP-02 closes ONLY the description-window sub-cause.
- `BUG-260610-01` duplicate empty-assistant-avatar — StreamsProvider/MessageList double-mount race. Separate family.
- `BUG-260609-02` SUB-RESULTS sub-task desc loss on nav.
- Sketch 049-B (promoted floating-chip trigger) — fallback only if users report lost always-visible status post-ship.
- The outer "Setting up agent…" banner (`toolMeta.ts:73 outerBannerLabel`) — do NOT touch.
- `backend/app/api/threads.py` (G-5 extraction-due — do NOT grow it).
- The assistant-answer message branch (CTC-04 clamps USER prompts only).
- New runtime / shared-path forks (red line D-14).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TDP-02** | A tool's `description` streams live during the `preparing` window, before `tool_start`. | Pipeline traced end-to-end. The partial-JSON args ARE on the wire during preparing (`tool_args_progress` → `tc.argsCodeText`), but `tc.args.description` is NOT parsed until `tool_start`. **Needs a small frontend parse step** — see §TDP-02 verdict. No backend change. |
| **CTC-01** | Tool-card header shows the real provider logo per-provider, replacing the brand-pulse `Bot` dot. | `message.provider` (verbatim `runs.provider`) keys the map. `@lobehub/icons` ships every needed mark. Target: `RunCard.tsx:280-288` avatar div; mirror predicate at `MessageItem.tsx:137/315`. |
| **CTC-02** | Tool card = single canonical, complete, byte-identical surface for live run info on ALL providers. | The card already carries status/elapsed/step/file via `RunStatusStrip` + `unifiedStepCount` + `fileCount` (all provider-agnostic). CTC-02 = add the logo + the description uniformly; the rest is already uniform. Proof = D-06 live scoreboard. |
| **CTC-03** | Remove the redundant sticky composer timer (`StickyTimerBar`), gated on CTC-02. | Referenced ONLY at `ChatArea.tsx:523` (mount) + `:533` (def). Clean delete; must ALSO drop the now-unused `toolLabel` import (line 22). Two surviving status homes confirmed wired. |
| **CTC-04** | Long USER prompts collapse to a clamped preview + "Read more". | `MessageItem.tsx:205-217` user branch. Pure client-side clamp state. Fade dissolves to `hsl(258 90% 66%)` (the gradient violet end), not page bg. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider logo rendering (CTC-01) | Browser / Client | — | Pure presentation map over the already-resolved `message.provider`; no provider branch in any backend path (honors red line D-14). |
| Preparing-window description (TDP-02) | Browser / Client | API/Backend (already done) | The partial-JSON args bytes are ALREADY emitted by the backend (`tool_args_progress`). The missing piece is a **client-side parse** of those bytes during preparing — pure frontend. |
| Canonical run-info card layout (CTC-02) | Browser / Client | — | All run-info fields (status/elapsed/step/file) are already provider-agnostic frontend derivations; uniformity is a render concern. |
| Sticky-timer removal (CTC-03) | Browser / Client | — | Deleting one redundant frontend component; no wire change. |
| Long-prompt clamp (CTC-04) | Browser / Client | — | Pure CSS + client clamp state over `message.content`. |

**Every capability lives in the Browser/Client tier.** The single backend touchpoint (the `tool_args_progress` emission carrying partial `description`) is **already shipped** (Phases 075.x). No `threads.py`, no provider-service, no gateway change. This is a frontend-only phase by construction.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@lobehub/icons` | ^5.10.0 | Official AI/LLM provider brand marks (CTC-01) | `[VERIFIED: npm registry]` MIT, maintained by lobehub org, ships every provider mark we need, tree-shakeable. The locked D-08 choice. |
| `react` | ^19.2.4 (in repo) | Component framework | Existing stack. `@lobehub/icons` peerDep is `react ^19.0.0` — satisfied. |
| `vite` | ^8.0.0 (in repo) | Bundler — must tree-shake the icon set | Existing. `sideEffects:false` makes named imports drop all unused marks. |

### Supporting (all already in repo — no new install beyond `@lobehub/icons`)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.577.0 | The existing `Bot` glyph (CTC-01 fallback) + all other chat icons | Keep `Bot` as the unknown/LM-Studio/OpenAI-compat fallback per D-08. |
| `vitest` | ^4.1.0 | Unit tests | Validation Architecture. |
| `vitest-axe` | ^0.1.0 | a11y assertions | If any new interactive surface (Read-more button) needs an axe check. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@lobehub/icons` (D-08 locked) | Vendor the 8 `048/logos/*.svg` files | Operator explicitly rejected vendored SVGs (D-08); the package is maintained + adds Ollama/LmStudio marks the sketch dir lacks. No need to re-litigate. |
| `.Color`/`.Mono` sub-components | `.Avatar` sub-component | **`.Avatar` drags `antd` + `antd-style`** (peerDep `antd ^6.1.1`) — a multi-hundred-KB dependency for a 32px icon. Use `.Color`/`.Mono` (pure SVG, zero deps) on a hand-rolled tinted backing instead. **HIGH-confidence gotcha.** |

**Installation:**
```bash
cd frontend && npm install @lobehub/icons@^5.10.0
```

**Version verification (done this session):**
```
npm view @lobehub/icons version  →  5.10.0   (latest; published 2026-06-16)
npm view @lobehub/icons license  →  MIT
slopcheck scan                   →  [OK] @lobehub/icons (npm)
```

## Package Legitimacy Audit

| Package | Registry | Age | Maintainers / Source Repo | slopcheck | Disposition |
|---------|----------|-----|---------------------------|-----------|-------------|
| `@lobehub/icons` | npm | v5.10.0 published 2026-06-16; project years old (lobehub org) | 7 maintainers incl. `lobehubbot`, `arvinxx`, `canisminor1990`; repo `github.com/lobehub/lobe-icons` | `[OK]` | **Approved** — install behind a single `checkpoint:human-verify` per house process; evidence is strong (official org repo, MIT, named in D-08). |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

slopcheck v0.6.1 ran cleanly and rated `@lobehub/icons` `[OK]`. Registry + official-repo + maintainer-list cross-check all corroborate. The package name was specified by the operator in D-08 (not discovered by Claude), and confirmed on the correct ecosystem (npm). **Tagged `[VERIFIED: npm registry]`.**

**Peer-dependency note (load-bearing for the planner):** `@lobehub/icons` declares `peerDependencies: { "@lobehub/ui": "^5.0.0", "antd": "^6.1.1", "react": "^19.0.0", "react-dom": "^19.0.0" }` and `dependencies: [antd-style, es-toolkit, lucide-react, polished]`. **npm/Vite will NOT error on the unmet `@lobehub/ui`/`antd` peers** because the `.Color`/`.Mono` icon modules never import them (verified: their only imports are `react`'s `memo` + the local `style` + `jsx-runtime`). Only `.Avatar` reaches `features/IconAvatar` which uses `antd-style`. **Directive: import ONLY `.Color`/`.Mono`; never `.Avatar`** — then no antd code is reachable and the bundle stays minimal. (If a future audit warns about unmet peers, it is benign for our import surface.)

## Architecture Patterns

### System Architecture Diagram — the TDP-02 description data flow

```
                          ┌─────────────────── BACKEND (already shipped — DO NOT TOUCH) ───────────────────┐
   model streams          │                                                                                 │
   tool-call args  ──────►│  Provider stream (anthropic_service / google_service / openai_compat adapter)  │
   (partial JSON)         │     • content_block_delta / input_json_delta / chunk.tool_calls[].arguments     │
                          │     • accumulates raw arg string in tool_blocks[idx]["arguments"]               │
                          │           │                                                                     │
                          │           ├─ yields  tool_preparing {id,name,index}   (name known, args empty)  │
                          │           ├─ yields  tool_args_progress {args_so_far(5KB tail), code_so_far,    │
                          │           │            total_args_bytes_so_far}      ← PARTIAL JSON, every 5KB   │
                          │           └─ yields  tool_start {name, args:dict}     ← args PARSED, at block end│
                          │                                                                                 │
                          │  agent_loop._on_chunk  →  _emit(redis, run:{run_id}, <event>, …)                │
                          └────────────────────────────────────┬────────────────────────────────────────────┘
                                                               │ SSE over run:{run_id} Redis Stream
                          ┌────────────────────────────────────▼──────────── FRONTEND ──────────────────────┐
                          │  api.ts  parses SSE  →  StreamsProvider callbacks                                │
                          │     onToolPreparing  → tc = { args:{}, status:"preparing", argsCodeText:undef }  │
                          │     onToolArgsProgress → tc.argsCodeText = code_so_far ; tc.argsBytesStreamed=…  │  ◄── partial JSON
                          │                          (tc.args STAYS {} here — NOT parsed)                    │      lives HERE
                          │     onToolStart     → tc.args = <parsed dict> ; status:"running"                 │  ◄── description
                          │                                                                                 │      lands HERE today
                          │  RunCard / ToolCallPanel render the card from tc.*                               │
                          └─────────────────────────────────────────────────────────────────────────────────┘

  TDP-02 GAP:  during "preparing", description lives ONLY inside the raw tc.argsCodeText string,
               not in tc.args.description. To show it before tool_start, the frontend must
               parse {"description": "..."} out of the partial-JSON tc.argsCodeText.
```

### Recommended file structure (net-new + edits)
```
frontend/src/
├── lib/
│   ├── providerLogo.tsx        # NET-NEW (D-05 shared helper): providerLogo(provider) + preparingDescription(tc)
│   └── toolMeta.ts             # UNCHANGED (do NOT touch :73 outerBannerLabel — deferred)
├── components/chat/
│   ├── RunCard.tsx             # EDIT: avatar :280-288 → providerLogo(message.provider); strip already wired
│   ├── ToolCallPanel.tsx       # EDIT: preparing branch :819-833 → preparingDescription(tc) (shared helper)
│   ├── ChatArea.tsx            # EDIT: DELETE StickyTimerBar :517-585 + the toolLabel import :22
│   └── MessageItem.tsx         # EDIT: user branch :205-217 → clamp + Read-more (CTC-04)
```

### Pattern 1: D-05 shared `providerLogo()` helper
**What:** A single module both `RunCard` and `ToolCallPanel` import — the `message.provider → @lobehub/icons` map + the locked fallback, returned as a small React component on a tinted backing.
**When to use:** Anywhere the tool-card header avatar renders (today: `RunCard.tsx:280-288`).
**Example (shape — planner refines):**
```tsx
// frontend/src/lib/providerLogo.tsx  — NET-NEW (D-05)
import { Bot } from "lucide-react"
import { OpenAI, Anthropic, Gemini, DeepSeek, Moonshot, Zhipu, Minimax, OpenRouter, Ollama } from "@lobehub/icons"
// NOTE: import the brand modules; use the .Color sub-component where it exists,
// else the brand default (.Mono). NEVER .Avatar (it drags antd — see audit).

// Keys are the EXACT runs.provider strings (config.py MODEL_CAPABILITIES["provider"]).
// Verified: GLM→"zhipu", Kimi→"moonshot". OpenRouter is NOT unwrapped (D-08).
const MARKS: Record<string, React.ComponentType<{ size?: number }>> = {
  openai:     OpenAI,           // no .Color → use brand default (mono) on tinted backing
  anthropic:  Anthropic,        // no .Color → brand default
  google:     Gemini.Color,     // .Color exists (brand gradient)
  deepseek:   DeepSeek.Color,
  moonshot:   Moonshot,         // no .Color → brand default
  zhipu:      Zhipu.Color,      // GLM/Zhipu — keyed "zhipu"
  minimax:    Minimax.Color,
  openrouter: OpenRouter,       // D-08: OpenRouter mark, do NOT unwrap to routed model
  ollama:     Ollama,           // D-08: local provider keeps its own mark
}

export function providerLogo(provider: string | undefined) {
  const Mark = provider ? MARKS[provider] : undefined
  // D-08 fallback: lmstudio / openai-compat / unknown / undefined → today's Bot dot.
  return Mark ?? null   // null → caller renders the gradient-primary Bot fallback
}
```
The caller (RunCard) keeps the existing `gradient-primary` rounded backing + `animate-brandPulse` ring (D-01 "brandPulse stays while streaming"), and swaps the `<Bot>` glyph for `providerLogo(message.provider)` when non-null, else falls back to `<Bot>`.

### Pattern 2: TDP-02 preparing-description extraction (the actual missing piece)
**What:** During `status === "preparing"`, `tc.args.description` is undefined; the description (if the model has emitted it yet) lives inside the partial-JSON `tc.argsCodeText`. Parse it tolerantly.
**When to use:** The preparing branch of the tool card (`ToolCallPanel.tsx:819-833`) and any preparing-window description surface.
**Example:**
```ts
// in providerLogo.tsx (or a sibling toolDescription.ts) — shared so RunCard + ToolCallPanel agree
export function preparingDescription(tc: ToolCall): string | null {
  // 1. If args already parsed (running/done, or a provider that delivered atomically) → trust it.
  if (typeof tc.args?.description === "string" && tc.args.description) return tc.args.description
  // 2. During preparing, try to extract "description" from the partial-JSON args text.
  const raw = tc.argsCodeText
  if (!raw) return null
  // tolerant: try a full parse first, then a regex for the description key.
  try { const o = JSON.parse(raw); if (typeof o?.description === "string") return o.description } catch { /* partial */ }
  const m = raw.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/)   // first complete "description":"…"
  return m ? JSON.parse(`"${m[1]}"`) : null   // unescape via JSON
}
```
**D-06 honest fallback:** the card always renders (logo + status). When `preparingDescription(tc)` is `null`, show the existing quiet `Preparing {toolLabel(tc.name)}…` copy (already at `ToolCallPanel.tsx:820`). **Never fabricate.**

### Pattern 3: CTC-04 overflow-detect clamp (D-03 cheapest-honest)
**What:** Always render the user bubble inside a `-webkit-line-clamp:7` container; measure `scrollHeight > clientHeight` with a ref + layout effect; only then reveal the fade overlay + "Read more". Expanded state removes the clamp.
**Example:**
```tsx
// MessageItem.tsx user branch (replaces the bare <p> at :210)
const pRef = useRef<HTMLParagraphElement>(null)
const [overflowing, setOverflowing] = useState(false)
const [expanded, setExpanded] = useState(false)
useLayoutEffect(() => {
  const el = pRef.current
  if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1)
}, [message.content])
// ...
<div className="relative">
  <p
    ref={pRef}
    className={cn("whitespace-pre-wrap break-words", !expanded && "[display:-webkit-box] [-webkit-line-clamp:7] [-webkit-box-orient:vertical] overflow-hidden")}
  >{message.content}</p>
  {overflowing && !expanded && (
    // fade overlay → dissolves to the VIOLET end of the 135° gradient: hsl(258 90% 66%)
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[hsl(258_90%_66%)] to-transparent" />
  )}
  {overflowing && (
    <button onClick={() => setExpanded(v => !v)} className="mt-1 text-xs text-white/80 underline">
      {expanded ? "Show less" : "Read more"}
    </button>
  )}
</div>
```
**Gotchas:** (1) `useLayoutEffect` so the measure runs before paint (no flicker). (2) re-measure on `message.content` change (covers the streaming-then-final swap; though a USER message is static once sent). (3) clamp lives on the `<p>`, the fade is an absolute sibling, so the bubble's `rounded-br-md` + `max-w-[70%]` shape is untouched. (4) the fade color is **`hsl(258 90% 66%)`** (= `gradient-primary`'s second stop, index.css:199) — NOT the page bg.

### Anti-Patterns to Avoid
- **Importing `@lobehub/icons` `.Avatar`** — pulls antd. Use `.Color`/`.Mono` on the existing `gradient-primary` div.
- **`import * as Icons from "@lobehub/icons"`** — defeats tree-shaking. Use named imports for the 9 marks only.
- **Touching `tc.args` in `onToolArgsProgress`** to "make description available" — the existing reducer deliberately keeps `tc.args = {}` until `tool_start` (the late-event race guard, StreamsProvider.tsx:406-409). Do NOT mutate `tc.args` mid-stream; read `tc.argsCodeText` instead.
- **Unwrapping OpenRouter to the routed model's brand** — D-08 forbids it; show the OpenRouter mark (the honest resolved provider).
- **Clamping the assistant branch** — CTC-04 is USER prompts ONLY (D-03).
- **Growing `threads.py` or any provider service** — TDP-02 is frontend-only; the bytes are already emitted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider brand SVGs | Hand-trace 9 logos / vendor `048/logos/*.svg` | `@lobehub/icons` `.Color`/`.Mono` | D-08 locked; maintained; adds Ollama/LmStudio the sketch dir lacks; gradient-ID collisions auto-handled via `useFillId`. |
| Gradient-ID de-collision across multiple SVG marks | Manual `id` namespacing | `@lobehub/icons` ships `useFillId`/`useFillIds` internally on Color marks | The MANIFEST note "no cross-provider gradient-ID collisions" is satisfied by the package's own fill-id hook. |
| Elapsed/step/file run-info | A new per-provider timer | The existing `RunStatusStrip` + `unifiedStepCount` + `fileCount` in RunCard | Already provider-agnostic and honest (095 never-vanishes). CTC-02 only adds logo+description. |
| Partial-JSON streaming parse for the WHOLE args | A streaming-JSON library | A targeted `"description":"…"` regex + try/parse | We need ONE key during a ≤few-second window; a full streaming-JSON parser is overkill and risks new edge cases. |

**Key insight:** This phase is ~90% composition of shipped primitives. The only genuinely net-new artifacts are (a) the `@lobehub/icons` import + the `providerLogo` map, (b) a ~6-line partial-JSON `description` extractor, and (c) a ~15-line CSS clamp. Everything else is deletion (CTC-03) or reuse.

## Runtime State Inventory

> Phase 128 is a frontend code-change phase. No stored data, no live-service config, no OS-registered state, no secret/env renames, no build-artifact concerns. The one "dependency" is a new npm package (`@lobehub/icons`), covered in Environment Availability.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB keys, collections, or persisted strings change. The `is_hero` precedent (written-but-unread) is untouched. | None — verified by scope (frontend render only). |
| Live service config | None — no n8n/Datadog/Tailscale/Cloudflare surface. | None — verified. |
| OS-registered state | None — no Task Scheduler / pm2 / systemd. | None — verified. |
| Secrets/env vars | None — no secret or env-var name changes. | None — verified. |
| Build artifacts / installed packages | `frontend/package.json` + `package-lock.json` gain `@lobehub/icons` (one new dependency). | `npm install` in `frontend/`; commit the lockfile. No stale-artifact risk (additive). |

## Common Pitfalls

### Pitfall 1: Assuming `tc.args.description` is already populated during preparing (CONTEXT.md correction)
**What goes wrong:** Building TDP-02 as "just read `tc.args.description` in the preparing branch" produces a blank description for the ENTIRE preparing window on every provider, because `tc.args = {}` until `tool_start` (StreamsProvider.tsx:381 + :446). The card would only show the description AFTER the prep gap closes — exactly the bug TDP-02 is meant to fix.
**Why it happens:** CONTEXT.md (line 191) states `tc.args.description` is "already present in the tool-call args" — TRUE at `tool_start`+, FALSE during `preparing`. The reusable-asset note conflated "the field exists on the wire" with "the parsed field is on `tc.args` during preparing."
**How to avoid:** Use `preparingDescription(tc)` (Pattern 2) which reads `tc.argsCodeText` (the partial-JSON string that IS populated during preparing) and falls back to `tc.args.description` once parsed.
**Warning signs:** A live UAT where the description only appears the instant the spinner flips to "running" — that means you read `tc.args` not `tc.argsCodeText`.

### Pitfall 2: Google delivers tool args ATOMICALLY → little/no preparing window
**What goes wrong:** Expecting a long, visible preparing-description window on Google. `google_service.py:454` notes Gemini "often ships function_call args ATOMICALLY in a single chunk" — `tool_preparing` → `tool_args_progress` → `tool_start` can fire back-to-back, so the description may appear effectively AT `tool_start`, not meaningfully before it.
**Why it happens:** Google's streaming groups the whole function_call into one chunk; there is no token-by-token args stream like Anthropic's `input_json_delta`.
**How to avoid:** This is acceptable per D-06 — the description still appears (just not in a long prep gap). Document it honestly in the scoreboard: Google = "description present, ~no prep-gap window." Do NOT add Google-specific code to force a window (red line D-14).
**Warning signs:** Google's card showing the description with no perceptible "Preparing…" beat — that's correct behavior, not a bug.

### Pitfall 3: `.Avatar` import bloats the bundle with antd
**What goes wrong:** `import { OpenAI } from "@lobehub/icons"; <OpenAI.Avatar />` reaches `features/IconAvatar` → `antd-style`, dragging a heavy dependency tree for a 32px icon.
**Why it happens:** The `.Avatar` convenience component is built on antd primitives for theming.
**How to avoid:** Import and render only `.Color`/`.Mono` (verified pure-SVG, zero deps) on the existing `gradient-primary` rounded div.
**Warning signs:** `npm install` adds `antd`/`@lobehub/ui` to the lockfile, or the build output jumps tens/hundreds of KB.

### Pitfall 4: Forgetting to drop the `toolLabel` import when deleting StickyTimerBar
**What goes wrong:** Deleting `StickyTimerBar` (ChatArea.tsx:533-585) leaves `import { toolLabel } from "@/lib/toolMeta"` (line 22) unused → TS/ESLint `no-unused-vars` error, build/CI fail.
**Why it happens:** `toolLabel` is used ONLY inside `StickyTimerBar` (line 554) within ChatArea.
**How to avoid:** Remove the import line too. (`Loader2`, `Message`, `Sparkles` etc. remain used elsewhere in ChatArea — only `toolLabel` goes.)
**Warning signs:** `tsc -b` fails on an unused import after the deletion.

### Pitfall 5: Measuring clamp overflow before layout / on a streaming user message
**What goes wrong:** Reading `scrollHeight`/`clientHeight` in a `useEffect` (post-paint) can flash the full bubble for one frame; reading before the ref mounts returns 0 (never shows Read-more).
**How to avoid:** `useLayoutEffect` + a ref guard. A USER message's content is static once sent, so a single measure on mount + a `[message.content]` dep is sufficient (no resize observer strictly required, though a window-resize re-measure is a nice-to-have).
**Warning signs:** Read-more never appears on a known-long prompt, or a one-frame full-height flash on render.

## Code Examples

### Verifying the canonical provider strings (already done — for the planner's confidence)
```ts
// backend/app/api/threads.py:292  — message.provider IS runs.provider, verbatim:
m["provider"] = run["provider"] if run else None
// backend/app/api/threads.py:1076 — runs.provider = MODEL_CAPABILITIES[model]["provider"]:
_capability_provider = _capability.get("provider", "unknown")
// config.py MODEL_CAPABILITIES values (the EXACT keys for the logo map):
//   "provider": "openai" | "anthropic" | "google" | "deepseek"
//             | "moonshot" | "zhipu" | "minimax" | "openrouter" | "ollama" | "lmstudio"
```

### The existing preparing branch that TDP-02 enhances (ToolCallPanel.tsx:819-833)
```tsx
// TODAY: preparing shows "Preparing {toolLabel}…" + a (X.X KB) byte badge.
// TDP-02: when preparingDescription(tc) is non-null, append/replace with the description;
//         when null, keep this exact quiet copy (D-06 honest fallback).
{tc.status === "preparing" ? (
  <span className="font-semibold text-foreground/50 italic">
    Preparing {toolLabel(tc.name)}…
    {/* TDP-02 add: {preparingDescription(tc) && <span> — {preparingDescription(tc)}</span>} */}
  </span>
) : ( … )}
```
Note: `ToolCallPanel.tsx:942-944` ALREADY reads `tc.args?.description` for the `ToolArgsLivePanel` title (`Generating {tool}: {description}`) — but that's gated on `tc.argsCodeText` being present AND reads the parsed `tc.args` (empty during early preparing). The shared `preparingDescription(tc)` unifies and corrects this read.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Brand-pulse `Bot` dot identical for every provider | Real per-provider mark via `@lobehub/icons` | This phase (CTC-01) | The header avatar distinguishes providers; brandPulse ring stays. |
| Three redundant elapsed surfaces (header strip + floating chip + `StickyTimerBar`) | Two honest homes (header strip in-view + floating chip on scroll-away) | This phase (CTC-03) | One less component, reclaimed chat-area vertical space, no "shows-for-some-vanishes-for-others" bug. |
| Description appears at `tool_start` | Description appears during `preparing` (parsed from partial args) | This phase (TDP-02) | Closes the prep-gap blind spot per provider. |

**Deprecated/outdated:**
- The `048/logos/*.svg` extracted marks → reference-only after D-08 (the npm package supersedes them; it also adds Ollama/LmStudio).
- The `StickyTimerBar` component → deleted (CTC-03).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Every provider emits `description` as an EARLY key in the partial-JSON args (so the regex catches it well before `tool_start`). | TDP-02 | LOW-MED. If a model emits `description` LAST in the JSON object, the partial-JSON window won't contain it until near-completion → the prep-gap window shows the quiet fallback longer. This is still honest (D-06), just less of a "win" for that provider. Verify per provider via the live Redis scoreboard. |
| A2 | TDP-01 (Phase 122) made `execute_code.description` reliably populated across providers via a prompt nudge + summarizer floor; other tools may not carry `description`. | TDP-02 | LOW. TDP-02's fallback (`Preparing {tool}…`) covers tools without a description by design. The win concentrates on `execute_code` (the tool TDP-01 targeted). |
| A3 | The `.Color`/`.Mono` icon modules will remain antd-free in 5.x patch releases. | Standard Stack | LOW. Pin `^5.10.0`; the pure-SVG structure is stable across the 5.x line. Re-verify imports if bumping to 6.x. |
| A4 | `unknown` and `lmstudio` are the only non-mapped `message.provider` values that reach the frontend in practice. | Provider key set | LOW. The fallback (Bot dot) is total — any unmapped string degrades gracefully. No correctness risk. |

**These four are all LOW/LOW-MED risk and all degrade to the honest fallback.** None blocks planning.

## Open Questions / verify-at-execution

1. **Per-provider live presence of `description` during the preparing window (the D-06 scoreboard's core check).**
   - What we know (from code): the partial-JSON args ARE streamed during preparing on all providers via `tool_args_progress`; the description is a normal arg key; Anthropic streams token-by-token (`input_json_delta`, real prep window), Google often atomic (~no window), OpenAI-compat path streams in deltas (real window). The frontend extractor (Pattern 2) reads `tc.argsCodeText`.
   - What's unclear WITHOUT a live run: whether each specific model emits `description` early enough in the JSON object to appear meaningfully before `tool_start`, and whether DeepSeek/Moonshot/GLM/MiniMax (the `<think>`-stripped OpenAI-compat models) populate `description` at all on a given prompt.
   - **Recommendation / method:** This is the D-06 LIVE native-7+OR scoreboard, authored in VALIDATION.md and operator-run. Method = inspect the `run:{run_id}` Redis stream (the same method `setting-up-agent-hides-model-activity` used) to confirm `tool_args_progress.code_so_far` contains `"description"` during preparing, AND watch the card live. Per-provider verdict table is filled at execution, not assumed. **Do not block planning on this — the code path is correct regardless; the scoreboard measures the WIN per provider.**

2. **Does `Gemini.Color` / `Zhipu.Color` etc. need an explicit `size` prop, and does the tinted backing read well in Deep Midnight?**
   - What we know: each mark accepts a `size` prop; the existing avatar div is `w-8 h-8` (32px). The marks are designed for both light/dark.
   - **Recommendation:** the planner/executor sets `size={18}` (or similar) inside the 32px `gradient-primary` backing and visually confirms against sketch 048-A during build (G-2 acceptance bar). Minor, build-time.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@lobehub/icons` | CTC-01 logos | ✗ (not yet installed) | 5.10.0 on npm | None needed — install it (D-08). The Bot-dot fallback is the runtime fallback for unmapped providers, not a substitute for the package. |
| `npm` / Node | install + build | ✓ | repo uses Vite 8 / React 19 | — |
| React 19.2 | peer of `@lobehub/icons` (^19.0.0) | ✓ | 19.2.4 | — satisfied |
| Vite 8 tree-shaking | bundle the 9 marks only | ✓ | 8.0.0 | `sideEffects:false` confirmed in the package |

**Missing dependencies with no fallback:** none — `@lobehub/icons` is a normal install (gated behind one `checkpoint:human-verify` per the package-legitimacy process, then `npm install`).
**Missing dependencies with fallback:** none.

## Validation Architecture

> nyquist_validation assumed enabled (not set to false in config). This phase touches streaming + provider routing + UI state → SC#10 4-axis coverage is MANDATORY (CLAUDE.md "UAT scoreboard recipe").

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 + @testing-library/react + vitest-axe 0.1.0 |
| Config file | `frontend/vitest.config.ts` (separate from `vite.config.ts`) |
| Quick run command | `cd frontend && npx vitest run src/__tests__/components/RunCard… ` (target the touched files) |
| Full suite command | `cd frontend && npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| CTC-01 | `providerLogo("zhipu")` returns the Zhipu mark; `providerLogo("lmstudio")`/`undefined` returns null (→ Bot fallback); OpenRouter not unwrapped | unit | `npx vitest run src/__tests__/lib/providerLogo.test.tsx` | ❌ Wave 0 |
| TDP-02 | `preparingDescription(tc)` extracts `description` from a partial-JSON `argsCodeText`; returns null on absent; prefers parsed `tc.args.description` when present | unit | `npx vitest run src/__tests__/lib/preparingDescription.test.ts` | ❌ Wave 0 |
| CTC-01/02 | RunCard renders the provider mark for a given `message.provider`; renders Bot for unknown; brandPulse ring class present while streaming | component | `npx vitest run src/__tests__/components/RunCard.logo.test.tsx` | ❌ Wave 0 |
| CTC-03 | After deletion, `StickyTimerBar` no longer renders below MessageList; the header strip + floating chip still render (regression) | component | extend `ChatArea`/`MessageList` tests | ❌ Wave 0 (no StickyTimerBar test exists today — deletion is low-risk) |
| CTC-04 | A long user `message.content` renders the clamp container + Read-more; a short one renders unchanged (no Read-more); fade color = `hsl(258 90% 66%)` | component | `npx vitest run src/__tests__/components/MessageItem.clamp.test.tsx` | ❌ Wave 0 (extends `MessageItem.test.tsx`) |
| TDP-02/CTC-02 | **D-06 LIVE native-7+OR scoreboard** — card carries {logo · status · elapsed · step/file · description} on each provider; cross-check `run:{run_id}` Redis stream for partial `description` | manual (VALIDATION.md) | operator-run; Chrome-MCP + psycopg2 :54322 + Redis stream inspect | ❌ Wave 0 (authored in VALIDATION.md) |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched-test-file>` (< 30s).
- **Per wave merge:** `cd frontend && npm test` (full vitest suite). NOTE: ~14-17 frontend vitest tests are pre-existing ROT (fail at baseline AND HEAD — `project_frontend_vitest_rot`); prove net-new green via a baseline checkout, not an absolute pass count.
- **Phase gate:** full suite (net of known rot) green + the D-06 live scoreboard passing BEFORE CTC-03 deletion (D-07) and before `/gsd:verify-work`.

### SC#10 4-Axis Coverage (MANDATORY — authored in VALIDATION.md)
| Axis | Required coverage for Phase 128 |
|------|--------------------------------|
| Cross-provider | The card + description + logo on **all native-7 + OpenRouter** (openai, anthropic, google, deepseek, moonshot, zhipu, minimax + openrouter) — D-06's explicit bar (NOT big-4, NOT static). Per-provider: logo correct, description present-or-honest-fallback, status/elapsed/step uniform. |
| Multi-tool | ≥1 row exercising 2+ tools in one prompt (e.g. `search_documents` + `execute_code`) — confirm the card stays uniform across tool switches and the preparing-description updates per tool. |
| Parallel-thread | ≥1 row with Thread A streaming (card live, description showing) while Thread B accepts a new prompt — confirm no cross-thread logo/description bleed (the `assistantId` scoping in StreamsProvider already guards this). |
| Long-message | ≥1 row with a ≥5KB pasted USER prompt → CTC-04 clamp + Read-more engages; AND a ≥50-prior-message thread → the card/strip still render honestly (no perf regression). |

### Wave 0 Gaps
- [ ] `src/lib/providerLogo.tsx` — the D-05 shared helper (logo map + `preparingDescription`)
- [ ] `src/__tests__/lib/providerLogo.test.tsx` — covers CTC-01 map + fallback + OpenRouter-no-unwrap
- [ ] `src/__tests__/lib/preparingDescription.test.ts` — covers TDP-02 partial-JSON extraction + honest-null
- [ ] `src/__tests__/components/RunCard.logo.test.tsx` — covers the avatar swap + brandPulse-preserved
- [ ] `src/__tests__/components/MessageItem.clamp.test.tsx` — covers CTC-04 overflow-detect + Read-more
- [ ] `frontend/package.json` — `npm install @lobehub/icons@^5.10.0` (gated by checkpoint)
- [ ] VALIDATION.md — the D-06 LIVE native-7+OR scoreboard rows (4-axis), operator-run, with the `run:{run_id}` Redis-stream cross-check method documented

## Security Domain

> `security_enforcement` assumed enabled. Frontend-only render phase with one new presentation dependency; the relevant ASVS surface is narrow.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation / Output Encoding | yes | `message.content` (CTC-04) + the parsed `description` (TDP-02) render as **React text children** — auto-escaped, never `dangerouslySetInnerHTML`. The existing code already enforces this (RunCard XSS note T-095.1-03-01); preserve it. The `preparingDescription` regex output is JSON-unescaped then rendered as text — safe. |
| V6 Cryptography | no | No crypto. |
| V2/V3/V4 Auth/Session/Access | no | No auth surface touched. |
| Supply chain (new dependency) | yes | `@lobehub/icons` cleared by slopcheck `[OK]` + registry/repo/maintainer cross-check; install behind one `checkpoint:human-verify` (house process). Pin `^5.10.0`; commit the lockfile. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via rendered model output (description / user prompt) | Tampering / Info-disclosure | React text children only (no innerHTML) — already the codebase rule; the new TDP-02 + CTC-04 render paths must follow it (they do in the patterns above). |
| Malicious/typosquatted icon package | Tampering | slopcheck `[OK]`, official lobehub repo, MIT, operator-specified in D-08, correct ecosystem (npm). Pinned + lockfile-committed. |
| Partial-JSON parse throwing in a render path | DoS (render crash) | The `preparingDescription` extractor wraps `JSON.parse` in try/catch and returns null on any failure — never throws in the render path (mirrors the existing `seamCardPayloadFor` "never throw in a render-path mapper" rule, MessageItem.tsx:117). |

## Sources

### Primary (HIGH confidence — read this session)
- `backend/app/services/agent_loop.py:1606-1760` — the shared `_on_chunk` consumer: `tool_preparing` / `tool_args_progress` (args_so_far + code_so_far) / `tool_start` (parsed args) emission to `run:{run_id}`.
- `backend/app/services/provider_gateway/openai_compat.py:290-364` — OpenAI-compat adapter: incremental `arguments` accumulation, `args_so_far` (5KB tail) + `code_so_far`, NO synthetic `tool_start`.
- `backend/app/services/anthropic_service.py:241-268` — Anthropic: `input_json_delta` partial-JSON streaming + `tool_args_progress` at 5KB boundaries; `tool_start` delayed to `content_block_stop`.
- `backend/app/services/google_service.py:445-606` — Google: function_call args often ATOMIC in one chunk → minimal preparing window.
- `frontend/src/providers/StreamsProvider.tsx:357-470` — `onToolPreparing` (args:{}), `onToolArgsProgress` (argsCodeText/argsBytesStreamed only, args stays {}), `onToolStart` (args parsed).
- `frontend/src/components/chat/RunCard.tsx:246, 280-320` — avatar (CTC-01 target), runSub (already threaded), RunStatusStrip wiring.
- `frontend/src/components/chat/ToolCallPanel.tsx:819-967` — preparing branch + the existing `tc.args?.description` read at :942.
- `frontend/src/components/chat/ChatArea.tsx:22, 517-585` — StickyTimerBar def + mount + the `toolLabel` import (CTC-03).
- `frontend/src/components/chat/MessageItem.tsx:205-217` — user bubble (CTC-04 target).
- `frontend/src/components/chat/MessageList.tsx:62, 208-227` — `showJumpToLive` floating chip (surviving status home #2).
- `frontend/src/components/chat/RunStatusStrip.tsx` — the canonical strip (surviving status home #1) + its prop shape.
- `backend/app/api/threads.py:292, 1076` — `message.provider` = verbatim `runs.provider` = `MODEL_CAPABILITIES[model]["provider"]`.
- `backend/app/config.py:11-19, 228-309` — the exact provider strings (openai/anthropic/google/deepseek/moonshot/zhipu/minimax/openrouter/ollama/lmstudio).
- `frontend/src/types/index.ts:55-92` — `ToolCall` shape (`args`, `argsCodeText`, `argsBytesStreamed`, `clientKey`).
- `.planning/reported-bugs/BUG-260610-01-…md` — the timer-reseed is in the HARNESS/WORKFLOW strip (Phase 127's surface), NOT the 095.1-fixed Deep RunStatusStrip → D-04 verdict: do NOT fold.

### Primary (HIGH confidence — npm registry, this session)
- `npm view @lobehub/icons` → v5.10.0, MIT, repo `github.com/lobehub/lobe-icons`, published 2026-06-16, 7 maintainers.
- `npm pack @lobehub/icons@5.10.0` (tarball inspection) → `sideEffects:false`, `module: es/index.js`, named exports `OpenAI/Anthropic/Claude/Gemini/Google/DeepSeek/Moonshot/Kimi/Zhipu/ChatGLM/Minimax/OpenRouter/Ollama/LmStudio`; `.Color`/`.Mono` are pure-SVG (react `memo` only), `.Avatar` pulls antd via `features/IconAvatar`; `useFillId` present (gradient-collision guard).
- `slopcheck scan` → `[OK] @lobehub/icons (npm)`.

### Secondary (MEDIUM confidence)
- `.planning/sketches/MANIFEST.md` decisions 38-40 + the Phase 128 wrap-up note — the locked sketch design + the "real `@lobehub/icons` marks, no gradient-ID collisions" note.
- `.planning/sketches/128-grounding/GROUNDING.md` — the real "before" anatomy + the 8-provider list + the 3-elapsed-surfaces.
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — the locked 014/015/016 chat-frame language this phase refines.

### Tertiary (LOW confidence — verify at execution)
- Per-provider live presence of partial `description` during preparing — the D-06 Redis-stream scoreboard (Open Question 1). Code path verified; per-model behavior measured at execution.

## Metadata

**Confidence breakdown:**
- TDP-02 mechanism (where/when description is available): **HIGH** — traced the full pipeline in source; the CONTEXT.md "already present" claim corrected with file:line evidence. The per-model WIN magnitude is the only LOW-confidence sub-item (measured live, D-06).
- CTC-01 / `@lobehub/icons` fit: **HIGH** — registry + tarball + slopcheck + the antd-avoidance gotcha all verified this session.
- Provider key set: **HIGH** — `message.provider` = verbatim `runs.provider` = `MODEL_CAPABILITIES["provider"]`, read from source.
- CTC-03 deletion safety: **HIGH** — `StickyTimerBar` referenced only twice; `toolLabel` import dependency identified; both surviving status homes confirmed wired.
- CTC-04 technique + fade color: **HIGH** — `gradient-primary` violet stop = `hsl(258 90% 66%)` read from index.css:199; overflow-detect pattern standard.
- D-04 (BUG-260610-01 fold): **HIGH** — the reseed is in the harness/workflow strip (Phase 127), not 128's Deep strip → leave open.

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 for the code anchors (stable; frontend hot files, re-verify line numbers if other phases land first); 2026-07-11 for `@lobehub/icons` (fast-moving npm — re-check `npm view` if more than two weeks elapse before install).
