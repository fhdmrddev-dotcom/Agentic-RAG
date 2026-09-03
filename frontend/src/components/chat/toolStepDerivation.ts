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

export function nodeStateOf(tc: ToolCall): NodeState {
  if (tc.status === "running" || tc.status === "preparing") return "active"
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
