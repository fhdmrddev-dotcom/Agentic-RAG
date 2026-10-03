/**
 * Phase 227 Wave 2 — toolStepDerivation.ts (B-3).
 *
 * Encapsulates pure, side-effect-free step state computation and derivations
 * extracted from ToolCallPanel.tsx:
 *   - displayItems list generation with interleaved skill activations
 *   - stepKeyOf stable identity resolver
 *   - toolStepNumber mapping
 *   - nodeStateOf deriving rail node state
 *   - lastPreparingIndex & activeIndex scanning
 *   - duration formatting
 */
import type { ToolCall, SkillActivation } from "@/types"
import type { NodeState } from "./StepRow"

export type DisplayItem =
  | { kind: "tool"; tc: ToolCall; t: number }
  | { kind: "skill"; activation: SkillActivation; t: number }

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function buildDisplayItems(
  deduplicatedToolCalls: ToolCall[],
  activatedSkills?: SkillActivation[],
): DisplayItem[] {
  return [
    ...deduplicatedToolCalls.map((tc): DisplayItem => ({
      kind: "tool",
      tc,
      t: tc.status === "preparing" ? Infinity : (tc.startedAt ?? Date.now()),
    })),
    ...(activatedSkills ?? []).map((activation): DisplayItem => ({
      kind: "skill",
      activation,
      t: activation.occurredAt,
    })),
  ].sort((a, b) => a.t - b.t)
}

export function stepKeyOf(tc: ToolCall, idx: number): string {
  return tc.clientKey ?? tc.id ?? `${tc.name}-${tc.startedAt ?? ""}-${idx}`
}

export function buildToolStepNumberMap(deduplicatedToolCalls: ToolCall[]): Map<string, number> {
  const map = new Map<string, number>()
  deduplicatedToolCalls.forEach((tc, idx) => {
    const key = tc.clientKey ?? tc.id ?? `${tc.name}-${tc.startedAt ?? ""}-${idx}`
    map.set(key, idx + 1)
  })
  return map
}

/**
 * Phase 273-05 (UI-D-02, OV-273-04): a done call whose result is a JSON object carrying the
 * structured refusal marker `status: "refused"` is a REFUSED step (amber node). Read from the
 * marker, never from the tool name: in v1 only one tool emits it, and any tool that adopts the
 * marker later gets the state for free. Strings only; never throws.
 */
function carriesRefusalMarker(result: string | undefined): boolean {
  if (typeof result !== "string" || !result.includes("refused")) return false
  try {
    const parsed: unknown = JSON.parse(result)
    return (
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) &&
      (parsed as { status?: unknown }).status === "refused"
    )
  } catch {
    return false
  }
}

export function nodeStateOf(tc: ToolCall): NodeState {
  if (tc.status === "running" || tc.status === "preparing") return "active"
  if (tc.status === "done" && carriesRefusalMarker(tc.result)) return "refused"
  if (tc.status === "done" || tc.status === "interrupted") return "done"
  return "queued"
}

export function findLastPreparingIndex(displayItems: DisplayItem[]): number {
  for (let i = displayItems.length - 1; i >= 0; i--) {
    const it = displayItems[i]
    if (it.kind === "tool" && it.tc.status === "preparing") return i
  }
  return -1
}

export function findActiveIndex(displayItems: DisplayItem[]): number {
  return displayItems.findIndex(
    (it) => it.kind === "tool" && (it.tc.status === "running" || it.tc.status === "preparing"),
  )
}
