---
phase: 067
plan: 02
type: execute
wave: 2
depends_on:
  - "067-01"
files_modified:
  - frontend/src/types/index.ts
  - frontend/src/hooks/useMessages.ts
  - frontend/src/components/chat/ToolCallPanel.tsx
autonomous: true
requirements:
  - STREAM-04-polish
must_haves:
  truths:
    - "On a multi-iteration agent run (e.g. execute_code → PNGs → execute_code → PNGs+DOCX), a thin gradient 'Step N' divider appears in ToolCallPanel between consecutive tool-calls whose iteration counter differs (UX-067-05)"
    - "The first iteration NEVER renders a 'Step 1' divider above it (clean entry per Pitfall 4)"
    - "Tool calls loaded from DB (historical messages, no `iteration` field) NEVER render dividers — undefined-vs-undefined is not a boundary"
  artifacts:
    - path: "frontend/src/types/index.ts"
      provides: "ToolCall extended with optional `iteration?: number` field — 0-based iteration index from iteration_start SSE event"
      contains: "iteration?: number"
    - path: "frontend/src/hooks/useMessages.ts"
      provides: "Stamping logic in onToolPreparing AND onToolStart that sets `iteration` on the ToolCall from a closure-tracked counter; counter incremented from onIterationStart"
      contains: "iteration: currentIteration"
    - path: "frontend/src/components/chat/ToolCallPanel.tsx"
      provides: "Gradient 'Step N' divider rendered between consecutive tool-calls when iteration differs and i > 0; uses existing Aether tokens (from-primary/30 to-primary/10 / via-primary/30 / text-muted-foreground)"
      contains: "Step {tc.iteration + 1}"
  key_links:
    - from: "useMessages.ts onIterationStart callback (line 274)"
      to: "closure-tracked currentIteration counter inside makeStreamCallbacks"
      via: "counter increment in onIterationStart"
      pattern: "currentIterationRef|currentIteration ="
    - from: "useMessages.ts onToolPreparing/onToolStart"
      to: "ToolCall objects stamped with `iteration: currentIteration`"
      via: "spread in the new ToolCall object literal"
      pattern: "iteration: currentIteration"
    - from: "ToolCallPanel.tsx render loop (line 636-657)"
      to: "Step N divider DOM with data-testid='iteration-divider'"
      via: "conditional `i > 0 && tc.iteration !== prevTc.iteration && tc.iteration !== undefined`"
      pattern: "data-testid=\"iteration-divider\""
---

<objective>
Render a subtle "Step N" gradient divider between tool-call iterations in `ToolCallPanel.tsx` so the user can see iteration boundaries on multi-iteration agent runs (UX-067-05). The wiring is mostly already in place — `iteration_start` SSE events fire (api.ts:394), `useMessages.ts` already increments `Message.iterationCount` (line 274) — but `ToolCall` has no per-call `iteration` field, so the panel cannot partition the flat `tool_calls[]` array into per-iteration groups.

This plan adds one optional field to `ToolCall`, stamps it in the two SSE callbacks that create ToolCall objects (`onToolPreparing`, `onToolStart`), and renders the divider in `ToolCallPanel.tsx`. Three small surgical edits across three files.

Purpose: closes UX-067-05. The user gets a visual boundary between agent iterations so multi-step work (search → report → charts → docx) reads as intentional progress rather than a runaway loop.

Output: types/index.ts with `iteration?: number` on ToolCall; useMessages.ts with stamping in both creation callbacks + a counter tracked from onIterationStart; ToolCallPanel.tsx with a gradient divider rendered between iteration boundaries using existing Aether tokens.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-01-state-machine-cleanup-PLAN.md

<interfaces>
<!-- Existing wiring this plan extends. -->

From `frontend/src/types/index.ts:28-43` (ToolCall — site of edit):
```typescript
export interface ToolCall {
  name: string
  id?: string
  args: Record<string, string>
  status: "running" | "done" | "interrupted" | "preparing"
  result?: string
  sub_agent?: SubAgentState
  startedAt?: number
  endedAt?: number
  outputLines?: OutputLine[]
  outputFiles?: OutputFile[]
  executionDurationMs?: number
  exitCode?: number
  errorMessage?: string
  // NEW (D-067-03): iteration?: number
}
```

From `frontend/src/hooks/useMessages.ts:73-92` (onToolPreparing — site of stamping):
```typescript
onToolPreparing: (name: string, index: number) => {
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== assistantId) return m
      const preparingId = `preparing-${index}`
      const alreadyPreparing = (m.tool_calls ?? []).some((tc) => tc.id === preparingId)
      if (alreadyPreparing) return m
      const preparingEntry: ToolCall = {
        id: preparingId,
        name,
        args: {},
        status: "preparing",
        startedAt: undefined,
      }
      return { ...m, isPlanning: false, tool_calls: [...(m.tool_calls ?? []), preparingEntry] }
    }),
  )
},
```

From `frontend/src/hooks/useMessages.ts:94-127` (onToolStart — site of stamping):
```typescript
onToolStart: (name, args) => {
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== assistantId) return m
      const existingCalls = m.tool_calls ?? []
      const preparingIdx = existingCalls.findIndex(
        (tc) => tc.name === name && tc.status === "preparing",
      )
      let updatedCalls: ToolCall[]
      if (preparingIdx !== -1) {
        updatedCalls = existingCalls.map((tc, i) =>
          i === preparingIdx
            ? { ...tc, args, status: "running" as const, startedAt: Date.now() }
            : tc,
        )
      } else {
        updatedCalls = [
          ...existingCalls,
          {
            id: `running-${Date.now()}`,
            name,
            args,
            status: "running" as const,
            startedAt: Date.now(),
          },
        ]
      }
      return { ...m, isPlanning: false, tool_calls: updatedCalls }
    }),
  )
},
```

From `frontend/src/hooks/useMessages.ts:273-278` (onIterationStart — counter source):
```typescript
onIterationStart: (iteration: number) => {
  setMessages((prev) =>
    prev.map((m) => (m.id === assistantId ? { ...m, iterationCount: iteration } : m)),
  )
},
```

From `frontend/src/components/chat/ToolCallPanel.tsx:636-657` (render loop — site of divider injection):
```tsx
{displayItems.map((item, i) => {
  if (item.kind === 'skill') {
    return (
      <div key={`skill-${i}-${item.activation.occurredAt}`}>
        {i > 0 && <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />}
        <SkillRow activation={item.activation} />
      </div>
    )
  }
  const tc = item.tc
  // ... tool-call render body ...
  return (
    <div key={i} className="pt-2.5 animate-toolSlideIn" style={{ animationDelay: `${i * 80}ms` }}>
      {/* Connecting line between tools */}
      {i > 0 && (
        <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />
      )}
      {/* tool body */}
    </div>
  )
})}
```

`displayItems` is constructed earlier in the component as a flat array of either `{kind: 'skill', activation: ...}` or `{kind: 'tool', tc: ToolCall}`. The divider must be injected when the previous item AND current item are both tools (skill rows do not partition iterations) AND their `tc.iteration` differs AND `i > 0`.

Existing Aether tokens to reuse (PATTERNS.md Pattern F):
- `h-px bg-border/20` — existing inter-tool separator (line 640, 656).
- `from-primary/30 to-primary/10` — existing preparing-bar gradient (line 705).
- `via-primary/30` — recommended for the Step N divider per PATTERNS.md.
- `text-muted-foreground/70` — recommended label color.
- Existing header `Step N` rendering at lines 542-544 (uses `iterationCount`) — DO NOT replace; this plan adds a complementary in-body divider.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add `iteration?: number` field to ToolCall type</name>
  <files>frontend/src/types/index.ts</files>
  <read_first>
    - frontend/src/types/index.ts (lines 28-43 — ToolCall interface)
    - .planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md (lines 286-318 — exact field shape with comment)
  </read_first>
  <behavior>
    - Adds an optional 0-based integer field; existing ToolCall consumers continue to work unchanged.
    - Persisted ToolCall objects from DB (historical messages — no SSE iteration info) MUST have undefined iteration; the panel's divider gating MUST treat undefined as "no boundary."
  </behavior>
  <action>
    In `frontend/src/types/index.ts` at line 28-43 (ToolCall interface), append a new optional field after `errorMessage?: string` (line 42). Add the doc comment verbatim from PATTERNS.md lines 309-313 to lock in the semantics for future readers:

    ```typescript
    /** D-067-03: 0-based iteration index from iteration_start SSE event. Used by
     * ToolCallPanel to render "Step N" gradient dividers between iteration groups.
     * Undefined for tool calls loaded from DB (historical messages — no divider). */
    iteration?: number
    ```

    Insert directly before the closing `}` of the ToolCall interface (after the `errorMessage?: string` line). Do NOT modify any other field. Do NOT change Message.iterationCount (that's the LATEST counter on the assistant message, not per-call partitioning — keep it; D-067-03 introduces ToolCall.iteration as orthogonal data).
  </action>
  <acceptance_criteria>
    - `grep -n "iteration?: number" frontend/src/types/index.ts` returns at least 2 matches (existing `iterationCount?: number` on Message at line 82 + new `iteration?: number` on ToolCall).
    - `grep -B1 "iteration?: number" frontend/src/types/index.ts | grep -c "D-067-03"` returns at least 1 (new field carries the D-067-03 comment).
    - Existing `iterationCount?: number` on Message at line ~82 still present (NOT replaced): `grep -n "iterationCount?: number" frontend/src/types/index.ts` returns 1 match.
    - `npx tsc --noEmit -p tsconfig.json` (run from `frontend/`) returns exit 0.
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
    ToolCall has an optional `iteration?: number` field. TypeScript compiles. Message.iterationCount untouched.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Stamp ToolCall.iteration in useMessages.ts callbacks (counter ref + spread in onToolPreparing/onToolStart)</name>
  <files>frontend/src/hooks/useMessages.ts</files>
  <read_first>
    - frontend/src/hooks/useMessages.ts (lines 30-285 — makeStreamCallbacks factory; lines 71-127 onToolPreparing + onToolStart; lines 273-278 onIterationStart)
    - .planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md (Pattern G — existing iterationCount consumer in ToolCallPanel; lines 269-282)
  </read_first>
  <behavior>
    - A closure-local counter (a `let` variable inside makeStreamCallbacks, not a useRef — the function returns fresh callbacks per call so closure scope is correct) tracks the latest iteration index.
    - onIterationStart updates the counter BEFORE updating Message.iterationCount.
    - onToolPreparing reads the counter and stamps it on the new preparing entry.
    - onToolStart reads the counter and stamps it on the new running entry, AND on the upgraded preparing-→running entry (preserve iteration set at preparing time, but if preparing was missed, stamp from current counter).
    - Default value: counter starts at 0 (the agent's first iteration is 0; iteration_start fires from the backend at iteration boundaries from the FIRST iteration onwards per `threads.py` D-066-04 emit semantics — but the initial value covers the case where a tool starts BEFORE the first iteration_start callback fires, which can happen on rapid-mock streams).
    - Persisted DB rows continue to load with undefined iteration on each ToolCall (no change to api.ts getMessages mapper — that maps from DB columns, ToolCall.iteration is not a DB column).
  </behavior>
  <action>
    In `frontend/src/hooks/useMessages.ts`, find the `makeStreamCallbacks` factory function (starts around line 30 with signature `function makeStreamCallbacks({...})`). Three edits inside this factory:

    **Edit 1 — Add counter declaration (BLK-5: concrete Find/Insert pair, not vague placement).** The `makeStreamCallbacks` factory at `useMessages.ts:45-53` has this exact verbatim signature + first statement (extracted from the codebase 2026-05-07 — if the source diverged, adapt the Find block to match):

    Find this block (verbatim from `frontend/src/hooks/useMessages.ts:45-53`):

    ```typescript
    function makeStreamCallbacks(opts: {
      assistantId: string
      threadId: string
      onTitleUpdate?: (title: string) => void
      setMessages: React.Dispatch<React.SetStateAction<Message[]>>
      setFallbackNotice: React.Dispatch<React.SetStateAction<string | null>>
    }): StreamCallbacks {
      const { assistantId, onTitleUpdate, setMessages, setFallbackNotice } = opts
      return {
    ```

    Replace with the SAME block plus a `let currentIteration = 0` inserted between the destructuring line and the `return {` line:

    ```typescript
    function makeStreamCallbacks(opts: {
      assistantId: string
      threadId: string
      onTitleUpdate?: (title: string) => void
      setMessages: React.Dispatch<React.SetStateAction<Message[]>>
      setFallbackNotice: React.Dispatch<React.SetStateAction<string | null>>
    }): StreamCallbacks {
      const { assistantId, onTitleUpdate, setMessages, setFallbackNotice } = opts
      // D-067-03: closure-tracked iteration counter, stamped onto each ToolCall
      // created in onToolPreparing/onToolStart. Updated on every iteration_start
      // SSE event BEFORE setMessages (no side-effects inside setMessages
      // updaters per Phase 057 deferral §1 / Phase 060 D-060-11). Default 0 —
      // covers tools that start BEFORE the first iteration_start callback fires
      // (rare with mock streams; backend's threads.py emits iteration_start at
      // iteration boundaries from the first iteration onward).
      let currentIteration = 0
      return {
    ```

    This places `let currentIteration = 0` in the factory's outer scope so the closures returned in the callbacks object (onToolPreparing, onToolStart, onIterationStart) all share the same captured variable. If the placement lands inside an inner scope (e.g., inside the returned object literal), `onToolStart`'s closure will not see updates from `onIterationStart` and the divider will never render — that is the BLK-5 failure mode this concrete Find/Insert prevents.

    **Edit 2 — Update onIterationStart to bump the counter BEFORE setMessages:** At line 273-278, change:

    ```typescript
    onIterationStart: (iteration: number) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, iterationCount: iteration } : m)),
      )
    },
    ```

    to:

    ```typescript
    onIterationStart: (iteration: number) => {
      // D-067-03: track latest iteration so subsequent onToolPreparing/onToolStart
      // can stamp it on new ToolCall objects. Update counter BEFORE setMessages
      // so next React batch sees consistent state.
      currentIteration = iteration
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, iterationCount: iteration } : m)),
      )
    },
    ```

    **Edit 3a — Stamp iteration in onToolPreparing:** At line 82-89 (the `preparingEntry` object literal), add `iteration: currentIteration` after `startedAt: undefined,`:

    ```typescript
    const preparingEntry: ToolCall = {
      id: preparingId,
      name,
      args: {},
      status: "preparing",
      startedAt: undefined,
      iteration: currentIteration,   // D-067-03: stamp current iteration on new tool call
    }
    ```

    **Edit 3b — Stamp iteration in onToolStart's two branches:**

    For the preparing-upgrade branch (line 105-109):
    ```typescript
    updatedCalls = existingCalls.map((tc, i) =>
      i === preparingIdx
        ? { ...tc, args, status: "running" as const, startedAt: Date.now() }
        : tc,
    )
    ```

    Change to (preserving any existing iteration on the preparing entry — the spread `...tc` already does this; no change needed for THIS sub-branch because preparing was already stamped in Edit 3a; ADD a defensive override only if iteration is undefined):

    ```typescript
    updatedCalls = existingCalls.map((tc, i) =>
      i === preparingIdx
        ? {
            ...tc,
            args,
            status: "running" as const,
            startedAt: Date.now(),
            // D-067-03: tc already carries iteration from onToolPreparing (Edit 3a),
            // but if preparing was missed (race / reconnect), stamp from counter.
            iteration: tc.iteration ?? currentIteration,
          }
        : tc,
    )
    ```

    For the no-preparing-fallback branch (line 113-122):
    ```typescript
    updatedCalls = [
      ...existingCalls,
      {
        id: `running-${Date.now()}`,
        name,
        args,
        status: "running" as const,
        startedAt: Date.now(),
      },
    ]
    ```

    Change to:
    ```typescript
    updatedCalls = [
      ...existingCalls,
      {
        id: `running-${Date.now()}`,
        name,
        args,
        status: "running" as const,
        startedAt: Date.now(),
        iteration: currentIteration,   // D-067-03: fallback path — no preparing entry; stamp directly
      },
    ]
    ```

    Do NOT touch onToolEnd (line 128-141 — preserves existing tc.iteration via spread). Do NOT touch any other callback.

    Discretion: this plan is keep-inline (per CONTEXT.md "prefer keep-inline unless diff exceeds ~150 lines"). Diff for this task ≈ 12 added lines; well within budget.
  </action>
  <acceptance_criteria>
    - `grep -n "let currentIteration = 0" frontend/src/hooks/useMessages.ts` returns at least 1 match.
    - `grep -n "currentIteration = iteration" frontend/src/hooks/useMessages.ts` returns at least 1 match (in onIterationStart).
    - `grep -c "iteration: currentIteration" frontend/src/hooks/useMessages.ts` returns at least 2 matches (preparing entry + no-preparing-fallback running entry).
    - `grep -c "iteration: tc.iteration ?? currentIteration" frontend/src/hooks/useMessages.ts` returns at least 1 match (preparing-upgrade defensive).
    - Existing onIterationStart still updates Message.iterationCount: `grep -A2 "onIterationStart: (iteration: number)" frontend/src/hooks/useMessages.ts | grep -c "iterationCount: iteration"` returns at least 1 (Message.iterationCount preserved — orthogonal field).
    - `npx tsc --noEmit -p tsconfig.json` (run from `frontend/`) returns exit 0.
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
    `currentIteration` counter declared inside makeStreamCallbacks. onIterationStart updates the counter and Message.iterationCount. onToolPreparing and both onToolStart branches stamp iteration on newly-created/upgraded ToolCall objects. TypeScript compiles. No other callbacks touched.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Render "Step N" gradient divider in ToolCallPanel.tsx between iteration boundaries</name>
  <files>frontend/src/components/chat/ToolCallPanel.tsx</files>
  <read_first>
    - frontend/src/components/chat/ToolCallPanel.tsx (lines 470-575 for header rendering using `iterationCount`; lines 636-657 for the inter-tool render loop where the divider belongs; lines 700-720 for existing gradient palette)
    - .planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md (Pattern E — divider injection point; Pattern F — Aether token reuse; lines 230-263 — exact divider JSX shape)
  </read_first>
  <behavior>
    - For each tool item in `displayItems`, when `i > 0` AND the current item AND the previous item are both tool kind (not skill — skill rows do not partition iterations) AND `tc.iteration !== prevTc.iteration` AND BOTH iterations are defined, render the "Step N" divider IN PLACE OF the existing `h-px bg-border/20` separator at line 654-657.
    - For the same conditions but `tc.iteration === prevTc.iteration` OR either undefined, keep the existing `h-px bg-border/20` separator unchanged (i.e. behavior is unchanged for same-iteration tools and for DB-loaded historical tool calls).
    - Skill rows keep their existing `h-px bg-border/20` separator unchanged (line 640).
    - First iteration NEVER renders a divider above it (Pitfall 4 — `i > 0` guard on the new divider too).
    - Persisted DB tool calls (no `iteration` field) NEVER render dividers — `tc.iteration === undefined` short-circuits.
    - The header-level `Step N` rendering (lines 529-544 — `stepPrefix` derived from `iterationCount`) is COMPLEMENTARY, not replaced. The header label says "Step N — Searching for X" once per render; the in-body divider says "Step N" between iterations. Both stay.
  </behavior>
  <action>
    In `frontend/src/components/chat/ToolCallPanel.tsx` at the render loop starting at line 636, modify the tool-kind branch to inject the new divider when an iteration boundary is detected. The existing `i > 0 && (<div className="h-px bg-border/20 ..." />)` separator at lines 654-657 is the augment point.

    Before the render loop's tool branch (just before `const tc = item.tc` at line 645), compute the previous tool's iteration via a helper. Add this helper INSIDE the map callback (it's per-iteration scope; do NOT lift outside the loop):

    ```typescript
    // D-067-03: get the previous tool item's iteration for boundary detection.
    // Skill rows don't partition iterations; walk back past consecutive skills
    // to find the most recent tool kind. undefined if no prior tool.
    let prevToolIteration: number | undefined = undefined
    if (item.kind === 'tool') {
      for (let j = i - 1; j >= 0; j--) {
        const candidate = displayItems[j]
        if (candidate.kind === 'tool') {
          prevToolIteration = candidate.tc.iteration
          break
        }
      }
    }
    ```

    Then in the existing tool render branch, replace the existing `i > 0 && (<div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />)` separator block (lines 654-657) with this conditional block (per PATTERNS.md lines 254-263):

    ```tsx
    {/* D-067-03: Step N divider on iteration boundary; plain inter-tool separator otherwise.
        Renders ONLY when (a) not the first item, (b) both current and previous tool items
        have a defined iteration, (c) iterations differ. Pitfall 4: NEVER above first iteration.
        WRN-3: stricter than PATTERNS.md Pattern F — also gate on prevToolIteration !== undefined
        to handle DB-loaded historical messages whose ToolCall objects have no `iteration` field
        (Pitfall 5). PATTERNS.md Pattern F's looser conditional would render a spurious divider
        on a thread where exactly one DB-loaded tool call precedes a fresh SSE-stamped tool call. */}
    {i > 0 && tc.iteration !== undefined && prevToolIteration !== undefined && tc.iteration !== prevToolIteration ? (
      <div
        className="flex items-center gap-2 my-3 mx-1"
        data-testid="iteration-divider"
        data-iteration={tc.iteration}
      >
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <span className="text-[10px] font-semibold text-muted-foreground/70 tracking-wider uppercase">
          Step {tc.iteration + 1}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>
    ) : i > 0 && (
      <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />
    )}
    ```

    DO NOT touch:
    - The skill-row branch at lines 637-643 (skill rows keep their existing `h-px bg-border/20` separator — they don't participate in iteration partitioning).
    - The header-level `stepPrefix` rendering at lines 542-544 (line label "Step N — ..." in headerLabel, complementary to in-body dividers).
    - The existing tool render body (the rest of lines 658-720).
    - The `iteration_start` SSE branch at api.ts:394-395 (no API change required — the stamping happens frontend-side per RESEARCH "Open Question 4" recommendation).

    Discretion (per CONTEXT.md): the divider style uses existing Aether tokens (`from-primary/30 to-primary/10` at line 705; `text-muted-foreground` at line 614; `via-primary/30` matches the existing Aether gradient palette). User-confirmed mockup is `──── Step 2 ──────`; this implementation matches that visually.
  </action>
  <acceptance_criteria>
    - `grep -n 'data-testid="iteration-divider"' frontend/src/components/chat/ToolCallPanel.tsx` returns at least 1 match.
    - `grep -n "Step {tc.iteration + 1}" frontend/src/components/chat/ToolCallPanel.tsx` returns at least 1 match (1-based label per user mockup).
    - `grep -n "tc.iteration !== prevToolIteration" frontend/src/components/chat/ToolCallPanel.tsx` returns at least 1 match (boundary check).
    - `grep -n "i > 0 && tc.iteration !== undefined && prevToolIteration !== undefined" frontend/src/components/chat/ToolCallPanel.tsx` returns at least 1 match (Pitfall 4 — never above first iteration; never on undefined).
    - Existing inter-tool separator (Pattern E) still present as the else-branch fallback: `grep -n "h-px bg-border/20 -mt-1 mb-2.5 mx-1" frontend/src/components/chat/ToolCallPanel.tsx` returns at least 2 matches (skill row separator at line ~640 + tool-row else-branch fallback).
    - Header-level Step N rendering preserved: `grep -n "Step \\${iterationCount" frontend/src/components/chat/ToolCallPanel.tsx` OR `grep -n "stepPrefix" frontend/src/components/chat/ToolCallPanel.tsx` returns at least 1 match (existing `iterationCount`-derived label untouched).
    - `npx tsc --noEmit -p tsconfig.json` (run from `frontend/`) returns exit 0.
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
    ToolCallPanel.tsx renders a gradient `Step N` divider with `data-testid="iteration-divider"` between consecutive tool items whose iteration counter differs (and both are defined and i > 0). Skill row separator and tool-row else-branch fallback separator preserved. Header-level Step N (from `iterationCount`) preserved. TypeScript compiles.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| SSE `iteration_start` event payload → counter | Existing trust boundary — `parsed.iteration` is asserted as `number` at api.ts:395 (existing surface, no new validation needed). |
| ToolCall.iteration → DOM render | Pure browser-local — no PII, no auth surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-067-02-01 | Tampering | iteration counter from SSE | accept | The SSE source is the same Redis Stream the rest of the chat surface trusts; if a malicious payload sets iteration to a wild number, the only consequence is a misleading "Step 99999" label — no auth bypass, no data corruption. |
| T-067-02-02 | Information disclosure | Step N divider DOM | accept | Iteration count is non-sensitive (visible to the user as part of the agent's normal output anyway via the header label since v2.3 Phase 56). |

No new auth/authz, no new external network egress, no new user-input parsing. Threat surface is bounded to existing browser-local React state.
</threat_model>

<verification>
Phase-wide checks for this plan (per D-067-07, deferred to Plan 05 for live UAT):
- TypeScript build green: `cd frontend && npx tsc --noEmit -p tsconfig.json` exits 0.
- All three required greps pass on Task 3 acceptance.
- Existing iterationCount header rendering preserved (Pattern G).
- Existing inter-tool separator preserved as else-branch.

Live verification (D-067-07 — moved to Plan 05 closing UAT):
- Chrome MCP: submit a multi-iteration prompt at http://localhost:5173/ (e.g., `execute_code → PNGs → execute_code → docx`); inspect DOM via Chrome MCP `evaluate_script`: `document.querySelectorAll('[data-testid="iteration-divider"]').length >= 1` confirms the divider rendered.
- Visual confirmation: `Step 2`, `Step 3`, etc. labels visible in the ToolCallPanel between iteration boundaries.
- Captured fully in Plan 05 evidence.
</verification>

<success_criteria>
- ToolCall has optional `iteration?: number` field.
- useMessages.ts stamps iteration on ToolCall in both onToolPreparing and both onToolStart branches.
- ToolCallPanel renders gradient Step N divider with `data-testid="iteration-divider"` on iteration boundaries (i > 0 + both defined + differ); else-branch falls through to existing inter-tool separator.
- TypeScript compiles green.
- No regression in header-level Step N rendering or skill-row separators.
- No new env vars, no migrations, no new dependencies.
</success_criteria>

<output>
After completion, create `.planning/phases/067-frontend-streaming-ux-fix/067-02-SUMMARY.md` documenting:
- ToolCall.iteration field added (line cited in types/index.ts).
- Stamping locations in useMessages.ts (counter declaration line, onIterationStart update, onToolPreparing stamp, two onToolStart stamps — all line cited).
- Divider injection point in ToolCallPanel.tsx (line cited).
- TypeScript build result.
- Any deviations from the plan (with rationale per Rule 3 of execute-plan.md).
</output>
