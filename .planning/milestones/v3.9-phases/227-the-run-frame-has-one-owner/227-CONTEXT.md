# Phase 227: The Run Frame Has One Owner - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 227 is a **pure refactor phase** of the chat run frame rendering architecture. It delivers **zero new capability, no wire change, no schema migration, and no new dependencies**. Its success condition is that **nothing changes on screen** across all eight run states (streaming, settled, failed, timed-out, cancelled, paused-on-approval, no-tools, sub-agent).

The objective is architectural consolidation: one visual object — the run frame — is currently rendered by three hot files (`MessageItem.tsx`, `RunCard.tsx`, and `ToolCallPanel.tsx`), none of which owns it. Phase 227 establishes a single owner component (`RunCard.tsx`), unifies the run frame responsibilities, extracts bloated subcomponents so `MessageItem.tsx` and `ToolCallPanel.tsx` legitimately leave "extraction due", pins all 14 covering test suites into the count gate before refactoring, and ensures the two deferred changes from Phase 224 (terminal status line inside the frame, right-aligned result column) become one-file edits without being implemented here.

</domain>

<decisions>
## Implementation Decisions

### Component Topology & Frame Ownership
- **D-01 (Evolve RunCard in place):** `frontend/src/components/chat/RunCard.tsx` is retained and evolved in place as the canonical owner of the run frame. We deliberately avoid introducing a new `RunFrame.tsx` file to prevent alias indirection, avoid import churn across 15+ test suites, and update the existing hot-file ledger row honestly.
- **D-02 (Single Run Renderer):** `MessageItem.tsx` renders *a run* rather than pieces of one. It stops directly rendering disjointed terminal status lines or fragmented live indicators.

### ToolCallPanel Extraction & Ledger Relief
- **D-03 (Decompose ToolCallPanel):** `ToolCallPanel.tsx` (currently 1019 lines, "extraction due") is decomposed into focused subcomponents:
  1. `frontend/src/components/chat/ToolCallDetails.tsx`: Owns payload/result inspection, arguments view, output/error rendering, diff blocks, and image previews (`ToolArgsBlock`, `ToolResultBlock`, `SubAgentBlock`).
  2. `frontend/src/components/chat/StepRow.tsx`: Owns timeline rail rendering, the status spine, step number, status node, and `ToolEssenceLine`.
  3. `frontend/src/components/chat/ToolCallPanel.tsx`: Becomes a slim step-list orchestrator (~250 lines) that dedups tool calls and maps them into `StepRow` and `ToolCallDetails`.
- **D-04 (Legitimate Ledger Discharge):** Both `MessageItem.tsx` and `ToolCallPanel.tsx` leave "extraction due" in `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` in the same commit because they have actually lost the responsibilities that drove their size and phase counts.

### Terminal Status Line Seam & Future 1-File Edit (SC#3)
- **D-05 (RunTerminalStatus Co-location):** Terminal status rendering (`Agent reached time limit` / `Response stopped`) is extracted into `RunTerminalStatus`, co-located in `RunCard.tsx`.
- **D-06 (Preserve Visual Layout):** In Phase 227, `MessageItem.tsx` delegates to `<RunTerminalStatus message={message} isStreaming={isStreaming} />` at its exact current location (below `message.content`), guaranteeing byte-identical DOM and visual rendering (SC#2).
- **D-07 (One-File Edit Enablement for SC#3):** Because `RunCard.tsx` now owns `RunTerminalStatus`, moving the terminal status line inside the run card frame in a future phase becomes a single-file edit in `RunCard.tsx` without needing to touch `MessageItem.tsx`.
- **D-08 (One-File Edit Enablement for Right-Aligned Column):** Because `StepRow.tsx` encapsulates `ToolEssenceLine` and its status pills, right-aligning the result column in a future phase becomes a single-file edit in `StepRow.tsx` without touching `ToolCallPanel.tsx` or `RunCard.tsx`. Neither change is made in Phase 227.

### Wave 1 Count Gate Pinning (SC#5)
- **D-09 (Pin All 14 Covering Suites):** Plan 227-01 (Wave 1) adopts the 14 covering suites identified in `227-MEASUREMENT-PACK.md` §4 into `TARGETS` and `BASELINE` of `scripts/vitest-count-gate.cjs` and re-derives the verdict line before any component refactoring code is written.

### Acceptance & Validation
- **D-10 (Before/After Browser Drive):** Visual acceptance requires a before/after browser drive by the operator across all 8 run states. `227-VALIDATION.md` will define explicit reproduction instructions for each state.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scoping & Architecture
- `.planning/phases/227-the-run-frame-has-one-owner/227-PROPOSAL.md` — Scoping proposal, G-6 failure modes, and "what must be TRUE".
- `.planning/phases/227-the-run-frame-has-one-owner/227-MEASUREMENT-PACK.md` — Fact pack from reviewer (gate baselines, G-5 triples, line-anchored seams, unpinned covering suites).
- `.planning/ROADMAP.md` § Phase 227 — Success criteria and constraints.
- `CLAUDE.md` — G-5 hot-file ledger rules and count gate invariants.
- `docs/HOT-FILE-LEDGER.md` — Current ledger status and history for `MessageItem.tsx`, `ToolCallPanel.tsx`, and `RunCard.tsx`.

### Precedent Phases
- `.planning/phases/224-what-the-agent-is-doing-reads-like-a-sentence/224-SUMMARY.md` — Deferred status line & step result column triggers.
- `.planning/phases/214-a-step-names-its-service-and-its-action/` — StepIdentity and service/action integration.
- `.planning/phases/095-calm-honest-run-card/` — D-04 unified step count and title calmness rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets & Anchor Seams
- `frontend/src/components/chat/RunCard.tsx:264`: Header title derivation `Run · N steps`.
- `frontend/src/components/chat/RunCard.tsx:436`: Collapsed run button `data-testid="run-card-collapsed"`.
- `frontend/src/components/chat/RunCard.tsx:507`: Thinking row `data-testid="thinking-row"`.
- `frontend/src/components/chat/RunCard.tsx:540`: Next-up footer `data-testid="next-up-footer"`.
- `frontend/src/components/chat/MessageItem.tsx:468`: Primary `<RunCard>` mount site.
- `frontend/src/components/chat/MessageItem.tsx:758`: Terminal status sentence site (`Agent reached time limit` / `Response stopped`).
- `frontend/src/components/chat/ToolCallPanel.tsx:444`: `StepRow` grid and spine rail.
- `frontend/src/components/chat/ToolCallPanel.tsx:348`: `ToolEssenceLine` row layout.
- `frontend/src/components/chat/ToolCallPanel.tsx:112`: `ToolArgsBlock` and `ToolResultBlock`.

### Covering Suites to Pin in Wave 1
- `src/components/chat/__tests__/MessageItem.test.tsx`
- `src/components/chat/__tests__/MessageItem.blockedNotice.test.tsx`
- `src/components/chat/__tests__/MessageItem.harnessBanner.test.tsx`
- `src/components/chat/__tests__/ChatAreaBanner.test.tsx`
- `src/components/chat/__tests__/ChatAreaMode.test.tsx`
- `src/__tests__/components/MessageItem.test.tsx`
- `src/__tests__/components/MessageItem.clamp.test.tsx`
- `src/__tests__/components/MessageItem.fallbackNotice.test.tsx`
- `src/__tests__/components/MessageItem.memo.test.tsx`
- `src/__tests__/components/MessageItem.sticky.test.tsx`
- `src/__tests__/components/RunCard.logo.test.tsx`
- `src/__tests__/components/ToolCallPanel.test.tsx`
- `src/__tests__/components/chat/MessageList.test.tsx`
- `src/__tests__/components/chat/MessageList.dedup.test.tsx`
- `src/__tests__/components/chat/MessageList.runline.baseline.test.tsx`

</code_context>

<specifics>
## Specific Ideas

- Ensure extracted files (`StepRow.tsx`, `ToolCallDetails.tsx`) are strictly modular with zero circular dependencies.
- Retain all `data-testid` attributes (`step-rail-line`, `step-node`, `step-snum`, `run-card-collapsed`, `thinking-row`, `next-up-footer`) to prevent breakage across existing and adopted test suites.
- Keep `ToolCallPanel` props API compatible so that callers (including `RunCard`) do not require breaking changes.

</specifics>

<deferred>
## Deferred Ideas

- **Right-aligned step result column:** Explicitly deferred per ROADMAP and 227-PROPOSAL; has an unresolved conflict with the 2026-08-31 noise audit. Made a 1-file edit in `StepRow.tsx` for a future phase.
- **Moving terminal status line inside the card border:** Explicitly deferred per SC#3 to ensure zero visual change in Phase 227. Made a 1-file edit in `RunCard.tsx` for a future phase.

</deferred>

---

*Phase: 227-The-Run-Frame-Has-One-Owner*
*Context gathered: 2026-09-03*
