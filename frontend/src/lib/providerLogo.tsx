/**
 * Phase 128 Plan 03 (D-05) — the ONE shared chat-tool-card helper module.
 *
 * This is the G-5 micro-extraction: both `RunCard.tsx` and `ToolCallPanel.tsx`
 * import from here (Plan 04) instead of each growing a private copy of the
 * provider→logo map or the preparing-description parse. Three exports:
 *
 *   1. `providerLogo(provider)` — maps the resolved `message.provider` string
 *      (CTC-01) to an `@lobehub/icons` brand mark, or `null` for unmapped keys
 *      so the caller renders its existing `Bot` fallback (D-08).
 *   2. `preparingDescription(tc)` — extracts a tool's `description` during the
 *      `preparing` window from the partial-JSON `tc.argsCodeText` (TDP-02).
 *   3. `modelLogo(modelId)` — maps a model id to its OWN `@lobehub` model-family
 *      mark (Claude sunburst, Gemini star, Kimi, …) for the model PICKER (the
 *      composer + Settings), or `null` so the caller falls back to `providerLogo`
 *      then its generic `Cpu` glyph. Same antd-free leaf-import invariant.
 *
 * SECURITY:
 *   - `provider` is the already-resolved `runs.provider` value (`config.py`
 *     MODEL_CAPABILITIES["provider"]) — not free user input. The returned mark
 *     is a React component (an SVG), rendered as a child element, never as
 *     interpolated/raw HTML. No `dangerouslySetInnerHTML`.
 *   - Only the `.Color`/`.Mono` brand marks are used from `@lobehub/icons`
 *     (pure SVG, zero deps). The `.Avatar` mark is NEVER used — it drags `antd`
 *     (research Pitfall 3).
 *   - Marks are imported from their DEEP COMPONENT subpaths
 *     (`@lobehub/icons/es/<Brand>/components/{Color,Mono}`), NOT the top-level
 *     `@lobehub/icons` barrel and NOT the brand index (`es/<Brand>`). Two
 *     antd-reachable paths exist and BOTH are avoided here:
 *       1. the barrel does `export * from "./features"` → `features/IconAvatar`
 *          → `@lobehub/ui` → `antd-style`;
 *       2. each brand `index.js` does `import Avatar from "./components/Avatar"`
 *          at line 1 (eager), and that `Avatar` reaches the same `IconAvatar`.
 *     `@lobehub/ui` is an UNMET peer, so either path throws at module-eval time
 *     under Vite. The leaf `components/Color`/`components/Mono` files import
 *     ONLY react + the local `useFillId`/`style` + `jsx-runtime` — verified
 *     antd-free across the full transitive graph.
 */
import type { ComponentType } from "react"
import type { ToolCall } from "@/types"
// Deep COMPONENT subpath imports — the `.Color`/`.Mono` leaf files only. Using
// the brand index (`es/<Brand>`) would eager-load its `Avatar` sub-component
// and drag antd; these leaf paths bypass it. `.Color` = the gradient brand
// mark; `.Mono` = the monochrome mark (for brands without a `.Color`).
import OpenAI from "@lobehub/icons/es/OpenAI/components/Mono"
import Anthropic from "@lobehub/icons/es/Anthropic/components/Mono"
import GeminiColor from "@lobehub/icons/es/Gemini/components/Color"
import DeepSeekColor from "@lobehub/icons/es/DeepSeek/components/Color"
import Moonshot from "@lobehub/icons/es/Moonshot/components/Mono"
import ZhipuColor from "@lobehub/icons/es/Zhipu/components/Color"
import MinimaxColor from "@lobehub/icons/es/Minimax/components/Color"
import OpenRouter from "@lobehub/icons/es/OpenRouter/components/Mono"
import Ollama from "@lobehub/icons/es/Ollama/components/Mono"
import LmStudio from "@lobehub/icons/es/LmStudio/components/Mono"
// Model-FAMILY marks for `modelLogo` (the model picker). Same deep-leaf pattern as
// the provider marks above (antd-free — verified: each `components/{Color,Mono}`
// leaf imports only react + jsx-runtime + local style/useFillId). These are the
// model's own brand (Claude's sunburst, Gemini's star, …), distinct from the
// provider mark; `.Color` where the brand ships a gradient, `.Mono` for Grok.
import Claude from "@lobehub/icons/es/Claude/components/Color"
import Gemma from "@lobehub/icons/es/Gemma/components/Color"
import Kimi from "@lobehub/icons/es/Kimi/components/Color"
import ChatGLM from "@lobehub/icons/es/ChatGLM/components/Color"
import Meta from "@lobehub/icons/es/Meta/components/Color"
import Mistral from "@lobehub/icons/es/Mistral/components/Color"
import Qwen from "@lobehub/icons/es/Qwen/components/Color"
import Grok from "@lobehub/icons/es/Grok/components/Mono"

/** An `@lobehub/icons` brand mark — a React component accepting a `size` prop. */
type ProviderMark = ComponentType<{ size?: number }>

/**
 * The provider→mark map. Keys are the EXACT `runs.provider` strings
 * (`config.py` MODEL_CAPABILITIES["provider"]) — NOT the model brand name:
 *   - GLM is keyed `zhipu` (not "glm"); Kimi is keyed `moonshot` (not "kimi").
 *   - `openrouter` → the OpenRouter mark; it is NOT unwrapped to the routed
 *     model's brand (D-08).
 * `.Color` is used where the brand ships a gradient mark (google/deepseek/
 * zhipu/minimax); the others use the brand default (the `.Mono` mark) — both
 * are pure SVG. `ollama` + `lmstudio` are the two local-connector marks (one per
 * local base-URL connector — operator override of the original D-08 Bot-fallback
 * for lmstudio). Only `unknown` / undefined are ABSENT → `providerLogo` returns
 * null → the caller renders the brand-pulse `Bot` dot.
 */
const MARKS: Record<string, ProviderMark> = {
  openai: OpenAI,
  anthropic: Anthropic,
  google: GeminiColor,
  deepseek: DeepSeekColor,
  moonshot: Moonshot,
  zhipu: ZhipuColor,
  minimax: MinimaxColor,
  openrouter: OpenRouter,
  ollama: Ollama,
  lmstudio: LmStudio,
}

/**
 * Resolve the provider brand mark for a chat tool-card header.
 *
 * @param provider the resolved `message.provider` string (or undefined for
 *   historical/loading messages)
 * @returns the `@lobehub/icons` mark component, or `null` for any unmapped
 *   provider (`unknown` / undefined) so the caller renders `Bot`.
 */
export function providerLogo(provider: string | undefined): ProviderMark | null {
  // ⚠ WR-04 (BUG-260807-01, the second sink found in the same sweep). The `?? null` was
  // NOT total over any key, despite the comment that used to claim it was: `MARKS` is a
  // plain object literal, so it inherits `constructor`, `toString`, `valueOf` and
  // `__proto__`, and for those names the lookup resolved the INHERITED member — a
  // function, never nullish — so `?? null` did not fire and this returned
  // `[Function Object]` typed as a `ProviderMark`. The caller then renders it as a
  // component. Totality is a property of the function, not of its current callers
  // (`lib/phaseState.ts:65-75`, the house argument).
  //
  // Guarded INLINE rather than through `components/workflows/ownProperty`, matching the
  // two other `lib/` guards (`phaseState.ts:77`, `phaseGlyph.tsx:92`): a `lib/` module
  // does not import from `components/`, and this tree ships exactly ONE own-guard
  // spelling — the ES2022 static alternative occurs zero times, measured.
  if (!provider) return null
  if (!Object.prototype.hasOwnProperty.call(MARKS, provider)) return null
  return MARKS[provider]
}

/**
 * The model-family → mark table for the model PICKER (composer + Settings). Each
 * entry is `[substring, mark]`; the FIRST whose substring appears in the
 * lowercased model id wins, so the order is most-specific-first. Unlike
 * `providerLogo` (keyed on the resolved provider), this reads the model id itself,
 * so a model keeps its OWN brand mark regardless of who serves it — an OpenRouter
 * provider hosting Llama / DeepSeek / Gemma surfaces three different marks, and
 * Claude's sunburst / Gemini's star (distinct from the Anthropic / Google provider
 * marks) surface on the model line.
 *
 * Keys are model-FAMILY names, NOT provider ids: `kimi`/`moonshot` → Kimi,
 * `glm`/`chatglm` → ChatGLM, `minimax`/`abab` → MiniMax, `gpt` → the OpenAI mark
 * (there is no distinct GPT art). `gemma` precedes `gemini` and `mixtral` precedes
 * `mistral` for readability only — the families don't overlap as substrings. Marks
 * reuse the same antd-free leaf imports as `MARKS` (`GeminiColor`/`DeepSeekColor`/
 * `MinimaxColor`/`OpenAI` are shared). Provider is NOT unwrapped from the id — a
 * bare `openrouter` selection with an opaque id simply falls through to null.
 */
const MODEL_MARKS: ReadonlyArray<readonly [string, ProviderMark]> = [
  ["claude", Claude],
  ["gemma", Gemma],
  ["gemini", GeminiColor],
  ["deepseek", DeepSeekColor],
  ["kimi", Kimi],
  ["moonshot", Kimi],
  ["chatglm", ChatGLM],
  ["glm", ChatGLM],
  ["minimax", MinimaxColor],
  ["abab", MinimaxColor],
  ["grok", Grok],
  ["mixtral", Mistral],
  ["mistral", Mistral],
  ["qwen", Qwen],
  ["llama", Meta],
  ["gpt", OpenAI],
]

/**
 * Resolve a model's OWN `@lobehub` brand mark for the model picker.
 *
 * @param modelId the model id (e.g. "claude-opus-4-7", "google/gemma-4-31b-it:free")
 * @returns the mark component, or `null` when no family matches so the caller
 *   falls back to `providerLogo(provider)`, then its generic `Cpu` glyph.
 */
export function modelLogo(modelId: string | undefined): ProviderMark | null {
  if (!modelId) return null
  const id = modelId.toLowerCase()
  for (const [needle, mark] of MODEL_MARKS) {
    if (id.includes(needle)) return mark
  }
  return null
}

/** First complete `"description":"…"` key in a JSON string (escapes tolerated). */
const DESCRIPTION_RE = /"description"\s*:\s*"((?:[^"\\]|\\.)*)"/

/**
 * Extract a tool's `description` for the tool-card header (TDP-02).
 *
 * During the `preparing` window the parsed `tc.args` is still `{}` (the
 * StreamsProvider reducer keeps it empty until `tool_start` — research
 * Pitfall 1 / Anti-Pattern), but the raw partial-JSON args stream is already
 * in `tc.argsCodeText`. This reads, in order:
 *   1. the parsed `tc.args.description` once present + non-empty (running/done,
 *      or a provider that delivered args atomically);
 *   2. a full `JSON.parse` of the partial-JSON `tc.argsCodeText`;
 *   3. a targeted `"description":"…"` regex over the (possibly truncated)
 *      partial JSON, JSON-unescaped.
 * Returns `null` when nothing is on the wire yet so the caller shows the quiet
 * `Preparing {tool}…` fallback (D-06: never fabricate; the description is
 * additive — the card always renders the logo + status regardless).
 *
 * NEVER throws: every `JSON.parse` is wrapped in try/catch returning `null`,
 * mirroring the `seamCardPayloadFor` "never throw in a render-path mapper" rule
 * (`MessageItem.tsx`). Never mutates `tc.args` (the reducer owns it).
 */
export function preparingDescription(tc: ToolCall): string | null {
  // 1. Trust the parsed value once present (and non-empty).
  if (typeof tc.args?.description === "string" && tc.args.description) {
    return tc.args.description
  }
  // 2. During preparing the parsed args are {} — the bytes live in argsCodeText.
  const raw = tc.argsCodeText
  if (!raw) return null
  // 2a. Try a full parse first (complete JSON object).
  try {
    const parsed = JSON.parse(raw) as { description?: unknown }
    if (typeof parsed?.description === "string") return parsed.description
  } catch {
    /* partial / truncated JSON — fall through to the targeted regex */
  }
  // 2b. Targeted regex for the first complete "description":"…" key, then
  //     JSON-unescape the captured group. Guarded so malformed escapes in the
  //     captured text can never throw in this render-path mapper.
  const m = raw.match(DESCRIPTION_RE)
  if (!m) return null
  try {
    return JSON.parse(`"${m[1]}"`) as string
  } catch {
    return null
  }
}
