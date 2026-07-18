# Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 9 (2 NEW lib + 4 MODIFY components + 4 NEW test files — `providerLogo.tsx` carries both helpers, so 2 NEW source files, not 3)
**Analogs found:** 9 / 9 (every file has an in-repo analog; this phase is ~90% composition of shipped primitives)

> Frontend-only phase. NO backend touch (`threads.py` untouched per G-5). The single backend dependency (the `tool_args_progress` partial-JSON emission) is already shipped. The only net-new install is `@lobehub/icons` (D-08).
>
> **Provider-at-the-boundary discipline (red line D-14):** the logo map is a PURE PRESENTATION map over the already-resolved `message.provider` string. It is NOT a streaming-path fork — no provider branch enters any backend or SSE path. Mirror `toolKey.ts` / `fileIcon.tsx`: a frontend pure function keyed off an already-resolved string.
>
> **G-5 de-dup discipline:** the `message.provider → logo` map AND the preparing-description logic live in ONE shared `providerLogo.tsx`. `RunCard.tsx` and `ToolCallPanel.tsx` both IMPORT it — neither grows a private copy (D-05).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `frontend/src/lib/providerLogo.tsx` | utility (lib helper) | transform (key→component map + partial-JSON parse) | `frontend/src/lib/fileIcon.tsx` (+ safe-parse idiom from `MessageItem.tsx:108-119`) | exact (map) + exact (idiom) |
| **MOD** `frontend/src/components/chat/RunCard.tsx` | component | request-response (render of stream state) | self (`:280-288` avatar is the in-place edit target) | in-place edit |
| **MOD** `frontend/src/components/chat/ToolCallPanel.tsx` | component | streaming (renders live `tc.*` during preparing) | self (`:819-833` preparing branch + `:942` description read) | in-place edit |
| **MOD** `frontend/src/components/chat/ChatArea.tsx` | component | request-response | self (`:521-585` StickyTimerBar = DELETE; `:22` import = DELETE) | in-place delete |
| **MOD** `frontend/src/components/chat/MessageItem.tsx` | component | request-response | self (`:205-217` user bubble = CTC-04 clamp target) | in-place edit |
| **NEW** `src/__tests__/lib/providerLogo.test.tsx` | test (unit) | — | `src/__tests__/lib/buildFolderTree.test.ts` | exact (lib-test scaffold) |
| **NEW** `src/__tests__/lib/preparingDescription.test.ts` | test (unit) | — | `src/__tests__/lib/buildFolderTree.test.ts` | exact (lib-test scaffold) |
| **NEW** `src/__tests__/components/RunCard.logo.test.tsx` | test (component) | — | `src/__tests__/components/MessageItem.test.tsx` (brandPulse-class assertion + `getByTestId`) | exact (component-test scaffold) |
| **NEW** `src/__tests__/components/MessageItem.clamp.test.tsx` | test (component) | — | `src/__tests__/components/MessageItem.test.tsx` (`makeMessage` factory + `renderWithTooltip`) | exact (extends the same suite) |

---

## Pattern Assignments

### `frontend/src/lib/providerLogo.tsx` (NEW — utility/transform) — the D-05 shared helper

This module exports BOTH `providerLogo(provider)` (CTC-01) and `preparingDescription(tc)` (TDP-02). It is the G-5 micro-extraction — the one place the map and the parse live.

**Analog A (the key→React-icon map): `frontend/src/lib/fileIcon.tsx`** — near-exact structural twin. A lib `.tsx` that maps a resolved key (extension) to a React icon component (Lucide glyph), with a `DEFAULT_SPEC` fallback and an explicit "model/sandbox-derived input → render as text only" security note. Copy this shape verbatim, swapping ext→provider and Lucide-glyph→`@lobehub/icons` mark.

**Imports + map + fallback pattern** (`fileIcon.tsx:23-105` — copy the SHAPE):
```tsx
import {
  Code, FileText, Image as ImageIcon, Presentation, Table,
  type LucideIcon,
} from "lucide-react"
import type { JSX } from "react"

/** A glyph category and the category color (canonical sketch hexes). */
type IconSpec = { color: string; Glyph: LucideIcon }

const DEFAULT_SPEC: IconSpec = { color: "#687076", Glyph: FileText }

// The canonical ext→(color, glyph) map. Keys are the canonical strings.
const EXT_MAP: Record<string, IconSpec> = {
  pptx: { color: "#f76707", Glyph: Presentation },
  pdf:  { color: "#e03131", Glyph: FileText },
  // …
}

export function fileIcon(filename: string, sizePx: number = 24): JSX.Element {
  const hasDot = filename.includes(".")
  const ext = hasDot ? (filename.split(".").pop() ?? "").toLowerCase() : ""
  const { color, Glyph } = EXT_MAP[ext] ?? DEFAULT_SPEC   // ← the `?? DEFAULT` fallback idiom
  return (/* … glyph + label … */)
}
```

**What to mirror for `providerLogo`:**
- A module-level `const MARKS: Record<string, …> = { … }` keyed off the EXACT `message.provider` strings (`openai · anthropic · google · deepseek · moonshot · zhipu · minimax · openrouter · ollama`). **GLM is keyed `zhipu`, Kimi is keyed `moonshot`** (research §Unknown #3). `lmstudio` / `unknown` / `undefined` are deliberately ABSENT → fall through to the `Bot` fallback (D-08).
- The `MARKS[key] ?? <fallback>` lookup — same idiom as `EXT_MAP[ext] ?? DEFAULT_SPEC`.
- **Import ONLY `.Color`/`.Mono` sub-components from `@lobehub/icons`, NEVER `.Avatar`** (research Pitfall 3 — `.Avatar` drags `antd`). Use named imports for the ~9 marks (NOT `import *`, which defeats tree-shaking).
- Keep the `import { Bot } from "lucide-react"` for the fallback (`Bot` is already imported in `RunCard.tsx:2`).
- Research §Pattern 1 gives the concrete provider→mark assignments (`google: Gemini.Color`, `openai: OpenAI` (mono), `zhipu: Zhipu.Color`, `openrouter: OpenRouter` — NOT unwrapped, etc.). Use that table.

**Analog B (the never-throw partial-JSON parse): `frontend/src/components/chat/MessageItem.tsx:108-119`** — the `seamCardPayloadFor` write_todos branch. This is THE codebase rule the research security row (V5, `MessageItem.tsx:117`) cites: a render-path mapper that JSON.parses model-derived bytes inside a try/catch and NEVER throws.

**Safe-parse idiom to copy verbatim** (`MessageItem.tsx:108-119`):
```ts
const raw = (tc.args as Record<string, unknown>).todos
let todos: Array<{ status?: string }> = []
if (Array.isArray(raw)) {
  todos = raw as Array<{ status?: string }>
} else if (typeof raw === "string") {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) todos = parsed
  } catch {
    /* leave empty — never throw in a render-path mapper */
  }
}
```

**What to mirror for `preparingDescription(tc)`:**
- Return `string | null`. Step 1: trust `tc.args?.description` when it is a non-empty string (the running/done/atomic-provider case). Step 2: during preparing, read `tc.argsCodeText` (the partial-JSON string — `tc.args` STAYS `{}` until `tool_start`, the Pitfall 1 correction). Try a full `JSON.parse` first, then a targeted `"description":"…"` regex, ALL wrapped in try/catch — return `null` on any failure (the `seamCardPayloadFor` rule).
- Research §Pattern 2 gives the exact ~10-line body. The regex + `JSON.parse(\`"${m[1]}"\`)` unescape are the only net-new lines beyond the `fileIcon` + `seamCardPayloadFor` shapes.
- **Type note:** `ToolCall.args` is typed `Record<string, string>` (`types/index.ts:37`), so `tc.args.description` is `string | undefined` already (no `{}` union) — but it is EMPTY `{}` at runtime during preparing. Read `tc.argsCodeText` (`types/index.ts:81`, `string | undefined`) for the preparing window, NOT `tc.args`.

**Anti-pattern (research §Anti-Patterns):** do NOT mutate `tc.args` in `onToolArgsProgress` to "make description available" — the StreamsProvider reducer deliberately keeps `tc.args = {}` until `tool_start` (late-event race guard). Read `tc.argsCodeText` instead.

---

### `frontend/src/components/chat/RunCard.tsx` (MOD — component) — CTC-01 avatar swap

**Analog:** self. The edit is in-place at the avatar div.

**Current imports** (`RunCard.tsx:1-10`) — `Bot` already imported, `cn` already imported. ADD `import { providerLogo } from "@/lib/providerLogo"`:
```tsx
import { memo, useEffect, useRef, useState } from "react"
import { Bot, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
// ADD: import { providerLogo } from "@/lib/providerLogo"
```

**The CTC-01 target — brand-pulse avatar** (`RunCard.tsx:280-288`, EXACT excerpt — swap the `<Bot>` glyph, keep EVERYTHING else):
```tsx
{/* Brand-pulse avatar — mirrors MessageItem.tsx:137 predicate verbatim. */}
<div
  className={cn(
    "flex-shrink-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center shadow-sm shadow-primary/20",
    isStreamingNow && "animate-brandPulse",          // ← D-01: brandPulse ring STAYS while streaming
  )}
>
  <Bot className="w-4 h-4 text-white" />              // ← swap to providerLogo(message.provider) ?? <Bot/>
</div>
```
**What to mirror / preserve:**
- Keep the `gradient-primary` rounded backing AND the `isStreamingNow && "animate-brandPulse"` class — D-01 "brandPulse ring stays while streaming in every case."
- Render `const Mark = providerLogo(message.provider)`; when non-null render `<Mark size={18} />` (research Open-Question 2: ~18px inside the 32px backing — confirm against sketch 048-A); when null keep `<Bot className="w-4 h-4 text-white" />`.
- `message.provider` is ALREADY threaded — it feeds `runSub` at `:246` (`${message.provider} · ${message.model} · turn ${turnNumber}`). No new prop, no new wire.
- **XSS rule (T-095.1-03-01):** the `runSub` comment at `:300-304` documents the standing "React text children only, never innerHTML" rule. A `@lobehub/icons` SVG component is safe (it is a component, not interpolated markup) — preserve the rule for any text you add.

**Mirror predicate:** the avatar predicate at `MessageItem.tsx:137` is "mirrored verbatim" per the `:280` comment. CTC-01 changes ONLY the RunCard tool-card header avatar; do NOT touch the `MessageItem` assistant-bubble avatar (out of scope — that is the `assistant-bot-icon` testid avatar, a different surface).

---

### `frontend/src/components/chat/ToolCallPanel.tsx` (MOD — component, streaming) — TDP-02 description surface

**Analog:** self. Two in-place reads to unify via the shared `preparingDescription(tc)`.

**The preparing branch — quiet-fallback copy** (`ToolCallPanel.tsx:819-833`, EXACT excerpt). TDP-02 appends the description WHEN present; keeps this exact quiet copy when null (D-06 honest fallback):
```tsx
{tc.status === "preparing" ? (
  <span className="font-semibold text-foreground/50 italic">
    Preparing {toolLabel(tc.name)}…
    {/* TDP-02 add: {preparingDescription(tc) && <span> — {preparingDescription(tc)}</span>} */}
    {tc.argsBytesStreamed != null && tc.argsBytesStreamed > 0 && (
      <span className="ml-1.5 font-normal text-foreground/40 not-italic font-mono tabular-nums">
        ({(tc.argsBytesStreamed / 1024).toFixed(1)} KB)
      </span>
    )}
  </span>
) : ( /* running/done branch — unchanged */ )}
```

**The existing parsed-args read to UNIFY** (`ToolCallPanel.tsx:940-945`) — today reads `tc.args?.description` directly (EMPTY during early preparing). Replace the read with the shared helper so RunCard + ToolCallPanel agree:
```tsx
<ToolArgsLivePanel
  title={
    tc.args?.description
      ? `Generating ${toolLabel(tc.name)}: ${tc.args.description}`   // ← route through preparingDescription(tc)
      : `Generating ${toolLabel(tc.name)}…`
  }
  …
/>
```
**What to mirror:**
- `toolLabel` is ALREADY imported in this file (the quiet-fallback copy at `:821` uses it) — keep using it for the `null` case.
- ADD `import { preparingDescription } from "@/lib/providerLogo"`.
- The card ALWAYS renders (logo + status) regardless of description — the description is additive (D-06). Never fabricate; `null` → keep `Preparing {toolLabel(tc.name)}…`.
- Note the Google-atomic honest UX block already at `:900-905` ("Waiting for model...") — DO NOT remove it; it is the same never-fabricate family. Google ships args atomically (research Pitfall 2) so its prep window is ~0 — acceptable per D-06.

---

### `frontend/src/components/chat/ChatArea.tsx` (MOD — component) — CTC-03 StickyTimerBar DELETE (LAST plan, D-07-gated)

**Analog:** self. Pure subtraction — NO net-new wire (D-02).

**DELETE the mount** (`ChatArea.tsx:517-524`, EXACT — remove the whole IIFE block):
```tsx
{/* Phase 076.1 D-03: Sticky elapsed timer above input box during active runs. */}
{isStreaming && (() => {
  const activeMsg = messages.findLast(m => m.role === "assistant")
  return activeMsg ? <StickyTimerBar message={activeMsg} /> : null
})()}
```

**DELETE the component def** (`ChatArea.tsx:530-585`, the entire `function StickyTimerBar({ message }: { message: Message }) { … }`).

**DELETE the now-unused import** (`ChatArea.tsx:22`) — research Pitfall 4: `toolLabel` is used ONLY inside `StickyTimerBar` (at `:554`); leaving it triggers a `no-unused-vars` build failure:
```tsx
import { toolLabel } from "@/lib/toolMeta"   // ← DELETE this whole line
```
**What to preserve (the two surviving status homes — D-02):**
- `MessageList` at `:509-516` stays — it owns the `showJumpToLive = !isPinned && isStreaming` floating "↓ Jump to live" chip (status home #2).
- The header `RunStatusStrip` (inside `RunCard`) stays — status home #1.
- `{inputBar}` at `:525` stays immediately after the deleted block.
- Other imports on the `lucide-react` line (`Folder as FolderIcon, Loader2, Menu, Sparkles`) and `Message` from `@/types` remain used elsewhere — ONLY the `toolLabel` import line goes.
- **Sequencing (D-07):** this is the LAST plan, gated on the D-06 live native-7+OR scoreboard proving CTC-02 holds. Do not delete before the proof.

---

### `frontend/src/components/chat/MessageItem.tsx` (MOD — component) — CTC-04 user-prompt clamp

**Analog:** self. Contained to the USER branch; the assistant branch is untouched (D-03).

**Current imports** (`MessageItem.tsx:1-2`) — `useRef`, `useState` ALREADY imported; ADD `useLayoutEffect`. `cn` is NOT yet imported here → add `import { cn } from "@/lib/utils"` (used by RunCard already, so the pattern exists):
```tsx
import { memo, useRef, useState } from "react"   // ← add useLayoutEffect
import { Sparkles, Loader2, RotateCcw, Square, User, Zap, Play } from "lucide-react"
```

**The CTC-04 target — user bubble** (`MessageItem.tsx:205-217`, EXACT excerpt). The clamp wraps ONLY the `<p>{message.content}</p>`; the bubble shell, alignment, tail, avatar all stay:
```tsx
if (isUser) {
  return (
    <div className="flex justify-end py-2 animate-fadeSlideUp" data-testid="user-message">
      <div className="flex items-end gap-2.5 max-w-[70%]">                          {/* ← max-w-[70%] PRESERVED */}
        <div className="gradient-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed shadow-sm">  {/* ← rounded-br-md tail PRESERVED */}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>      {/* ← clamp THIS <p> + fade sibling + Read-more */}
        </div>
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted border border-border/50 flex items-center justify-center mb-0.5">
          <User className="w-3.5 h-3.5 text-foreground/70" />                       {/* ← User avatar PRESERVED */}
        </div>
      </div>
    </div>
  )
}
```
**What to mirror (research §Pattern 3 — the cheapest-honest overflow-detect, D-03):**
- Add `const pRef = useRef<HTMLParagraphElement>(null)`, `const [overflowing, setOverflowing] = useState(false)`, `const [expanded, setExpanded] = useState(false)`.
- `useLayoutEffect(() => { const el = pRef.current; if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1) }, [message.content])` — `useLayoutEffect` (NOT `useEffect`) so the measure runs pre-paint (Pitfall 5: avoids the one-frame full-height flash).
- Wrap the `<p>` in a `<div className="relative">`; apply the clamp classes to the `<p>` only when `!expanded`: `[display:-webkit-box] [-webkit-line-clamp:7] [-webkit-box-orient:vertical] overflow-hidden`.
- The fade overlay is an `absolute` sibling that **dissolves to `hsl(258 90% 66%)`** (the violet end of the bubble's 135° `gradient-primary`, `index.css:199` — NOT the page bg): `bg-gradient-to-t from-[hsl(258_90%_66%)] to-transparent`, `aria-hidden`, `pointer-events-none`. Reveal it only when `overflowing && !expanded`.
- The "Read more"/"Show less" `<button onClick={() => setExpanded(v => !v)}>` renders only when `overflowing`.
- **Hook-order safety:** these hooks must run on EVERY MessageItem render (the component is `memo`-wrapped and has hooks BEFORE the `if (isUser)` early return at `:205` — e.g. `useWorkflowLockForThread`, `useState` at `:202-203`). The cleanest placement is to either (a) lift the clamp into a small child component rendered inside the user branch, OR (b) declare the three hooks at the top alongside the existing ones (before the `if (isUser)`). Option (a) (a `<UserBubble>` subcomponent) keeps the parent hook order pristine and is the lower-risk move — mirror how `FinalOutputsPanel` (`:73`) and `StickyTimerBar` are factored as local subcomponents in these files.
- **Short prompts render UNCHANGED** — when `!overflowing`, no fade, no button; the `<p>` is visually identical to today (the clamp classes are gated on `!expanded`, and the fade/button on `overflowing`).
- **USER prompts ONLY** — do NOT clamp the assistant branch (the `:218+` path that renders `RunCard` / `MarkdownRenderer`).

---

## Shared Patterns

### Lib-helper module shape (key→React component + safe fallback)
**Source:** `frontend/src/lib/fileIcon.tsx` (whole file) · also `frontend/src/lib/toolKey.ts` (pure key-derivation), `frontend/src/lib/toolMeta.ts` (label maps)
**Apply to:** `providerLogo.tsx`
- A `Record<string, T>` const map at module scope, keyed off an already-resolved string.
- A `MAP[key] ?? DEFAULT` lookup — total over any unmapped key (degrades gracefully).
- A JSDoc header naming the phase + the security posture (model/user-derived input → text children only). `fileIcon.tsx:16-21` and `toolKey.ts:1-21` both model this.
- Named imports only (tree-shaking) — never `import *`.

### Never-throw render-path parse
**Source:** `frontend/src/components/chat/MessageItem.tsx:108-119` (`seamCardPayloadFor` write_todos branch)
**Apply to:** `preparingDescription(tc)` in `providerLogo.tsx`
```ts
try {
  const parsed = JSON.parse(raw)
  // … use parsed …
} catch {
  /* leave empty — never throw in a render-path mapper */
}
```
The research V5/DoS security row cites this exact rule at `MessageItem.tsx:117`. Every `JSON.parse` on the partial-JSON `argsCodeText` MUST be inside try/catch returning `null`.

### XSS — React text children only (never innerHTML)
**Source:** `RunCard.tsx:300-304` + `:233` (T-095.1-03-01) · `fileIcon.tsx:16-19` (T-095-01-01) · `StickyTimerBar` `ChatArea.tsx:552` (T-076.1-05)
**Apply to:** the parsed `description` (TDP-02) and `message.content` (CTC-04) — both render as React text children, auto-escaped. Never `dangerouslySetInnerHTML`. The `@lobehub/icons` SVG marks are components (safe), not interpolated markup.

### Local subcomponent factoring (keeps parent hook order pristine)
**Source:** `MessageItem.tsx:73` (`FinalOutputsPanel`), `:92` (`seamCardPayloadFor`) · `ChatArea.tsx:533` (`StickyTimerBar`)
**Apply to:** the CTC-04 clamp — factor a `<UserBubble>` local subcomponent so its `useRef`/`useLayoutEffect`/`useState` do not perturb `MessageItem`'s hook order (which already has conditional-adjacent hooks before the `if (isUser)` return).

---

## Test Patterns

### Lib unit test scaffold
**Source:** `frontend/src/__tests__/lib/buildFolderTree.test.ts`
**Apply to:** `providerLogo.test.tsx` (CTC-01: `providerLogo("zhipu")` → Zhipu mark; `providerLogo("lmstudio")`/`undefined` → null; OpenRouter NOT unwrapped) and `preparingDescription.test.ts` (TDP-02: extract from partial-JSON `argsCodeText`; null on absent; prefer parsed `tc.args.description`).
```ts
import { describe, it, expect } from "vitest"
import { buildFolderTree } from "@/lib/folderTree"
import type { Folder } from "@/types"

function makeFolder(overrides: Partial<Folder> & { id: string; name: string }): Folder {
  return { user_id: "user-1", parent_id: null, /* …defaults… */, ...overrides }
}

describe("buildFolderTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildFolderTree([])).toEqual([])
  })
})
```
- **`providerLogo.test.tsx` is `.tsx`** (it renders / asserts on the returned component); `preparingDescription.test.ts` is `.ts` (pure value assertions, no JSX). Mirror `model-info.test.ts` (a sibling `.ts` lib test) for the pure-value one.
- For `preparingDescription`, build a `ToolCall` fixture with `makeToolCall({ status: "preparing", argsCodeText: '{"description":"render a chart"' })` (truncated partial JSON) and assert the extracted string; another with `argsCodeText: '{"code":"x=1"'` (no description key) → `null`.

### Component (render) test scaffold
**Source:** `frontend/src/__tests__/components/MessageItem.test.tsx` (whole file) + `ToolCallPanel.test.tsx:30-60` (the `mkDoneTool`/`mkActiveTool` factories)
**Apply to:** `RunCard.logo.test.tsx` and `MessageItem.clamp.test.tsx`.
```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message } from "@/types"

const NOW = new Date().toISOString()
function makeMessage(overrides: Partial<Message> = {}): Message {
  return { id: "msg-1", thread_id: "thread-1", user_id: "user-1",
           role: "user", content: "Hello world", created_at: NOW, updated_at: NOW, ...overrides }
}
function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}
```
**Idioms to copy:**
- `renderWithTooltip(<… />)` — RunCard / MessageItem render inside a `TooltipProvider` (both `MessageItem.test.tsx:25` and `ToolCallPanel.test.tsx:36` do this).
- **brandPulse assertion** (`MessageItem.test.tsx:147-155`) — the exact pattern for "the ring stays while streaming":
  ```tsx
  const botIcon = screen.getByTestId("assistant-bot-icon")
  expect(botIcon.className).toContain("animate-brandPulse")
  ```
  For `RunCard.logo.test.tsx`: render with `message.runStatus: "streaming"` + a `message.provider`, assert the provider mark renders AND the avatar wrapper `.className` still contains `animate-brandPulse`; render with `provider: "lmstudio"` (or undefined) and assert the `Bot` glyph renders (fallback). RunCard has `data-testid="run-card"` (`RunCard.tsx:252`) to scope queries; consider adding a stable testid on the avatar div if needed.
- **container.querySelector for class/structure** (`MessageItem.test.tsx:36-60`) — `container.querySelector(".gradient-primary")`, `.querySelectorAll(".rounded-full")`. For `MessageItem.clamp.test.tsx`: a long `message.content` renders the Read-more button (`screen.getByRole("button", { name: /read more/i })`); a short one does NOT (`screen.queryByRole(...)` is null). NOTE: jsdom does not lay out, so `scrollHeight`/`clientHeight` are both 0 — the overflow-detect effect won't fire in jsdom; assert the STRUCTURE (clamp container present, button-absent-on-short) and the fade color CLASS (`from-[hsl(258_90%_66%)]`) rather than the runtime measurement. The live overflow behavior is covered by the D-06 manual UAT.
- **factory-with-required-override** (`ToolCallPanel.test.tsx:40`): `function mkTool(overrides: Partial<ToolCall> & { id: string }): ToolCall { return { name: …, args: {}, status: …, ...overrides } as ToolCall }`.

---

## Known Gotchas Carried From Research (executor must honor)

| Gotcha | Source | Rule |
|--------|--------|------|
| `tc.args.description` is EMPTY during preparing | research Pitfall 1; `StreamsProvider.tsx` reducer | Read `tc.argsCodeText` for the preparing window, NOT `tc.args`. `preparingDescription` falls back to `tc.args.description` once parsed. |
| `.Avatar` drags antd | research Pitfall 3 | Import ONLY `.Color`/`.Mono` from `@lobehub/icons`. Verify the lockfile does NOT gain `antd`. |
| Deleting StickyTimerBar orphans the `toolLabel` import | research Pitfall 4; `ChatArea.tsx:22` | Delete the import line too (`tsc -b` fails otherwise). |
| OpenRouter NOT unwrapped to routed model | D-08 | `openrouter` → the OpenRouter mark (honest resolved provider). |
| GLM=`zhipu`, Kimi=`moonshot` | research §Unknown #3; `config.py` | Key the map by the EXACT `runs.provider` strings, not the model brand. |
| jsdom has no layout | testing | Overflow-detect (`scrollHeight > clientHeight`) won't fire in jsdom; assert structure + classes, defer live overflow to D-06 manual UAT. |

---

## No Analog Found

None. Every file has a direct in-repo analog:
- `providerLogo.tsx` map ← `fileIcon.tsx`; its parse ← `seamCardPayloadFor` (`MessageItem.tsx:108-119`).
- All four MODIFY files are in-place edits to existing code (their own current state is the analog).
- All four test files ← `buildFolderTree.test.ts` (lib) / `MessageItem.test.tsx` + `ToolCallPanel.test.tsx` (component).

> Planner does NOT need to fall back to RESEARCH.md generic patterns for any file — the RESEARCH §Pattern 1/2/3 code blocks are the refined shapes, and the in-repo analogs above are the idioms to copy.

## Metadata

**Analog search scope:** `frontend/src/lib/` (helper modules), `frontend/src/components/chat/` (the four hot files + RunStatusStrip/MessageList survivors), `frontend/src/__tests__/` (lib + component test scaffolds), `frontend/src/types/index.ts` (ToolCall/Message shapes), `frontend/package.json` (dependency baseline).
**Files scanned:** ~16 read in full or in targeted ranges.
**Pattern extraction date:** 2026-06-27
