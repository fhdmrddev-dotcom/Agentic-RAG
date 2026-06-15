/**
 * Phase 094 Plan 01 Task 2 — shared DATA-CONTRACT §7 harness wire fixtures.
 *
 * Owner of every later test's wire payload. Plans 02/03/05 import these so a
 * harness SSE sequence is hand-rolled EXACTLY ONCE (single source of truth —
 * never re-author a `data:` frame in a test). Each fixture is a flat `string[]`
 * of blank-line-terminated `data: <JSON>` lines matching the EXACT `_emit`
 * producer wire shape (`harness_engine.py:105`), so a test replays them through
 * the REAL `subscribeToRun` line parser (api.ts:471-680) — exercising the live
 * normalizer, not a stubbed callback.
 *
 * Wire shape note (DATA-CONTRACT §2/§3b): the backend emits FLAT fields, never
 * nested — `{type, phase, phase_index, phase_type, attempt, error, reason,
 * from_phase, to_phase, via, status, ...}`. The per-phase return dicts are NOT
 * on the producer stream; phase identity rides only `phase_started` /
 * `phase_completed` / `phase_transition`, sub-agents ride `sub_agent_start` /
 * `sub_agent_done`, human input rides `ask_user_prompt` / `ask_user_response`,
 * and the end-of-run grounding rides `delta` / `sources` / `citations` /
 * `confidence` / `run_completed`.
 *
 * These are SAMPLE FIXTURE DATA (DATA-CONTRACT §1 rule 1): NO renderer keys on
 * the content (slugs, sub-question text, source counts) — only on the generic
 * 5-phase-type vocabulary + the lifecycle events. Naming follows §7: per-type
 * `fxPhase*`, per-run-state `fxRun*`.
 */

// ── wire frame helper ─────────────────────────────────────────────────────────
/**
 * Serialize one event object into the producer SSE frame string — a single
 * `data: <JSON>` line terminated by the blank line the line-parser splits on
 * (api.ts reads `data:` lines, JSON.parses the payload, dispatches on `.type`).
 */
export function wire(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`
}

/** Terminal `done` frame (the run-buffer end-of-stream sentinel). */
const DONE = wire({ type: "done" })
/** `stream_end` frame — the SSE-layer terminator used by the panel-hook tests. */
const STREAM_END = wire({ type: "stream_end" })

/**
 * The reconcile seed shape mirrors `ThreadWorkflowState` (the
 * `GET /threads/{id}/workflow` payload, `models/thread.py:48-85`) — the run-level
 * frame the live stream cannot reconstruct from scratch (definition_name +
 * current_phase_index/total_phases = the honest "Phase i / N" counter, the
 * reconcile FLOOR per the D-v2.5-03 anti-drift rule). Kept as a plain literal so
 * the fixtures module carries zero production-type import surface.
 */
export interface HarnessReconcileSeed {
  mode: "harness" | "deep"
  definition_name: string
  current_phase_index: number
  total_phases: number
  run_status: string
  latest_producer_run_id: string
}

// ═══════════════════════════════════════════════════════════════════════════
// PER-PHASE-TYPE FIXTURES (DATA-CONTRACT §7 — minimal real producer sequence
// per type; asserts the canonical render shape with NO invented count)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `programmatic` — a fixed server fn ran; only `phase_started`/`phase_completed`/
 * `phase_transition` carry identity. The return dict (e.g. split_topic's
 * `sub_questions`) is NOT on the wire → asserts "completed" with NO count chip.
 */
export const fxPhaseProgrammatic: string[] = [
  wire({ type: "phase_started", phase: "split", phase_index: 0, phase_type: "programmatic" }),
  wire({ type: "phase_completed", phase: "split", phase_index: 0 }),
  wire({ type: "phase_transition", from_phase: "split", to_phase: "review", via: "normal" }),
]

/**
 * `llm_single` — one AI write turn; `text` is persisted-only (not on the wire) →
 * asserts no per-phase body prose rendered, just running → done.
 */
export const fxPhaseLlmSingle: string[] = [
  wire({ type: "phase_started", phase: "draft", phase_index: 1, phase_type: "llm_single" }),
  wire({ type: "phase_completed", phase: "draft", phase_index: 1 }),
]

/**
 * `llm_agent` — parent phase + ONE nested sub-agent child row (bookended by
 * `sub_agent_start`/`sub_agent_done` on the PRODUCER stream). The sub-agent's
 * internal tool calls fire on a DIFFERENT stream → tool-call counts NOT shown.
 */
export const fxPhaseLlmAgent: string[] = [
  wire({ type: "phase_started", phase: "research", phase_index: 1, phase_type: "llm_agent" }),
  wire({
    type: "sub_agent_start",
    sub_run_id: "sa-1",
    description: "Overall topic — gather sources",
    tools: ["search_documents"],
    max_steps: 12,
  }),
  wire({
    type: "sub_agent_done",
    sub_run_id: "sa-1",
    status: "completed",
    summary: "Found and synthesized the relevant material.",
  }),
  wire({ type: "phase_completed", phase: "research", phase_index: 1 }),
]

/**
 * `llm_batch_agents` — parent + N nested children sharing one time band
 * (parallel). N = client tally of `sub_agent_start` for this phase (NEVER a
 * static field) → asserts `agentsSpawned === 4` is DERIVED, not hardcoded.
 */
export const fxPhaseLlmBatchAgents: string[] = [
  wire({ type: "phase_started", phase: "subtopics", phase_index: 2, phase_type: "llm_batch_agents" }),
  wire({ type: "sub_agent_start", sub_run_id: "sa-1", description: "Sub-question 1", tools: ["search_documents"], max_steps: 12 }),
  wire({ type: "sub_agent_start", sub_run_id: "sa-2", description: "Sub-question 2", tools: ["search_documents"], max_steps: 12 }),
  wire({ type: "sub_agent_start", sub_run_id: "sa-3", description: "Sub-question 3", tools: ["search_documents"], max_steps: 12 }),
  wire({ type: "sub_agent_start", sub_run_id: "sa-4", description: "Sub-question 4", tools: ["search_documents"], max_steps: 12 }),
  wire({ type: "sub_agent_done", sub_run_id: "sa-1", status: "completed", summary: "Subtopic 1 result." }),
  wire({ type: "sub_agent_done", sub_run_id: "sa-2", status: "completed", summary: "Subtopic 2 result." }),
  wire({ type: "sub_agent_done", sub_run_id: "sa-3", status: "completed", summary: "Subtopic 3 result." }),
  wire({ type: "sub_agent_done", sub_run_id: "sa-4", status: "completed", summary: "Subtopic 4 result." }),
  wire({ type: "phase_completed", phase: "subtopics", phase_index: 2 }),
]

/**
 * `llm_human_input` — phase pauses on `ask_user_prompt` (carrying the additive
 * D-12 `draft` = prior-phase text) and advances on `ask_user_response` → asserts
 * the draft renders ABOVE the chips, labelled draft; pending-ask reuses the
 * existing `pendingAsksByThread` store (POINTER, never duplicated).
 */
export const fxPhaseLlmHumanInput: string[] = [
  wire({ type: "phase_started", phase: "review", phase_index: 3, phase_type: "llm_human_input" }),
  wire({
    type: "ask_user_prompt",
    tool_call_id: "tc-1",
    prompt: "Does this draft look right?",
    options: ["Looks good", "Needs changes"],
    timeout_seconds: 300,
    draft: "<prior phase text>",
  }),
  wire({ type: "ask_user_response", tool_call_id: "tc-1" }),
  wire({ type: "phase_completed", phase: "review", phase_index: 3 }),
]

// ═══════════════════════════════════════════════════════════════════════════
// PER-RUN-STATE FIXTURES (DATA-CONTRACT §7 — full-run sequences; each exports
// the live `string[]` AND a `reconcileSeed` matching ThreadWorkflowState)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `fx-run-running` — reconcile gives "Phase 2 / 3", live phases advance, last
 * phase still `running` → asserts the counter comes from reconcile, advanced by
 * live, with the not-yet-started phase skeletoned as `pending`.
 */
export const fxRunRunningReconcileSeed: HarnessReconcileSeed = {
  mode: "harness",
  definition_name: "X",
  current_phase_index: 1,
  total_phases: 3,
  run_status: "running",
  latest_producer_run_id: "r-1",
}
export const fxRunRunning: string[] = [
  wire({ type: "phase_started", phase: "p0", phase_index: 0, phase_type: "programmatic" }),
  wire({ type: "phase_completed", phase: "p0", phase_index: 0 }),
  wire({ type: "phase_transition", from_phase: "p0", to_phase: "p1", via: "normal" }),
  wire({ type: "phase_started", phase: "p1", phase_index: 1, phase_type: "llm_agent" }),
  // last phase left RUNNING (no phase_completed, no terminal) — the live state
]

/**
 * `fx-run-gatefail-retry` — `gate_failed{attempt:1}` then `{attempt:2}`
 * (non-terminal retries) then `phase_completed` → asserts per-attempt stacked
 * rows ("Attempt 1 / Attempt 2"), purple `retrying`, then green; NO `gate_passed`
 * event (pass INFERRED from advance).
 */
export const fxRunGatefailRetry: string[] = [
  wire({ type: "phase_started", phase: "verify", phase_index: 1, phase_type: "llm_single" }),
  wire({ type: "gate_failed", phase: "verify", attempt: 1, error: "Output did not match the required schema." }),
  wire({ type: "gate_failed", phase: "verify", attempt: 2, error: "Output did not match the required schema." }),
  wire({ type: "phase_completed", phase: "verify", phase_index: 1 }),
]

/**
 * `fx-run-gatefail-wallclock` — the wall-clock variant: the verbatim typed
 * signal `"wall_clock_timeout after 600s"` (`harness_engine.py:480`) as the
 * `gate_failed.error`, taxonomized distinctly from a validator message.
 */
export const fxRunGatefailWallclock: string[] = [
  wire({ type: "phase_started", phase: "research", phase_index: 1, phase_type: "llm_agent" }),
  wire({ type: "gate_failed", phase: "research", attempt: 1, error: "wall_clock_timeout after 600s" }),
  wire({ type: "phase_completed", phase: "research", phase_index: 1 }),
]

/**
 * `fx-run-failed` — `gate_failed{attempt:2}` (exhausted) → `run_failed{reason}` →
 * terminal `done` (the RC-4 WRONG sentinel — `done` despite a failed run) →
 * asserts the failure is keyed off `run_failed`, NOT `done`; renders FAILED.
 */
export const fxRunFailedReconcileSeed: HarnessReconcileSeed = {
  mode: "harness",
  definition_name: "X",
  current_phase_index: 1,
  total_phases: 3,
  run_status: "failed",
  latest_producer_run_id: "r-2",
}
export const fxRunFailed: string[] = [
  wire({ type: "phase_started", phase: "verify", phase_index: 1, phase_type: "llm_single" }),
  wire({ type: "gate_failed", phase: "verify", attempt: 2, error: "Output did not match the required schema." }),
  wire({ type: "run_failed", reason: "Gate 'verify' failed after 2 attempts." }),
  wire({ type: "done" }),
]

/**
 * `fx-run-failed-reason-unknown` — companion: `run_failed{reason:""}` → asserts
 * the explicit `reason_unknown` sentinel copy ("Failure reason not captured by
 * the backend"), NEVER an empty red card.
 */
export const fxRunFailedReasonUnknown: string[] = [
  wire({ type: "phase_started", phase: "verify", phase_index: 1, phase_type: "llm_single" }),
  wire({ type: "gate_failed", phase: "verify", attempt: 2, error: "" }),
  wire({ type: "run_failed", reason: "" }),
  wire({ type: "done" }),
]

/**
 * `fx-run-askuser-paused` — `phase_started{llm_human_input}` → `ask_user_prompt`
 * (with draft) → the stream IDLES (no terminal) → asserts the paused state,
 * visible draft, PendingAskCard as the answer surface, composer stays locked.
 */
export const fxRunAskuserPausedReconcileSeed: HarnessReconcileSeed = {
  mode: "harness",
  definition_name: "X",
  current_phase_index: 2,
  total_phases: 3,
  run_status: "running",
  latest_producer_run_id: "r-3",
}
export const fxRunAskuserPaused: string[] = [
  wire({ type: "phase_started", phase: "review", phase_index: 2, phase_type: "llm_human_input" }),
  wire({
    type: "ask_user_prompt",
    tool_call_id: "tc-pause-1",
    prompt: "Approve the draft to continue?",
    options: ["Looks good", "Needs changes"],
    timeout_seconds: 300,
    draft: "<prior phase text>",
  }),
  // intentionally NO terminal frame — the run idles paused awaiting the answer
]

/**
 * `fx-run-done` — full happy path: phases ×N → `delta` → `sources` → `citations`
 * → `confidence` → `run_completed{status:"completed"}` → terminal `done` →
 * asserts run-level "K sources" from `sources.length` at completion; "N phases"
 * = total_phases (both real); per-phase tool-call counts SUPPRESSED.
 */
export const fxRunDoneReconcileSeed: HarnessReconcileSeed = {
  mode: "harness",
  definition_name: "X",
  current_phase_index: 2,
  total_phases: 3,
  run_status: "completed",
  latest_producer_run_id: "r-4",
}
export const fxRunDone: string[] = [
  wire({ type: "phase_started", phase: "p0", phase_index: 0, phase_type: "programmatic" }),
  wire({ type: "phase_completed", phase: "p0", phase_index: 0 }),
  wire({ type: "phase_transition", from_phase: "p0", to_phase: "p1", via: "normal" }),
  wire({ type: "phase_started", phase: "p1", phase_index: 1, phase_type: "llm_agent" }),
  wire({ type: "phase_completed", phase: "p1", phase_index: 1 }),
  wire({ type: "phase_transition", from_phase: "p1", to_phase: "p2", via: "normal" }),
  wire({ type: "phase_started", phase: "p2", phase_index: 2, phase_type: "llm_single" }),
  wire({ type: "phase_completed", phase: "p2", phase_index: 2 }),
  wire({ type: "delta", content: "Here is the final synthesized answer." }),
  wire({ type: "sources", sources: [{ document_id: "doc-1", title: "Source one" }, { document_id: "doc-2", title: "Source two" }] }),
  wire({
    type: "citations",
    citations: [
      { document_id: "doc-1", chunk_index: 0, passage: "A grounding passage from source one." },
      { document_id: "doc-2", chunk_index: 3, passage: "A grounding passage from source two." },
    ],
  }),
  wire({ type: "confidence", level: "high", avg_similarity: 0.82, disclaimer: "Based on the retrieved sources." }),
  wire({ type: "run_completed", status: "completed" }),
  wire({ type: "done" }),
]

// ── re-exported terminators (so a test can append its own end-of-stream) ──────
export { DONE, STREAM_END }
