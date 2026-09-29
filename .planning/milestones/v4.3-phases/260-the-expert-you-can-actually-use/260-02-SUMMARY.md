---
phase: 260-the-expert-you-can-actually-use
plan: 02
subsystem: frontend / chat / composer
tags: [react, chat, composer, expert_bundles, active_expert_chip, invite_dialog]

# Dependency graph
requires: [260-01]
provides:
  - "frontend/src/types/index.ts with active_expert_id on Thread and ExpertBundle interface"
  - "frontend/src/lib/api/experts.ts with listExperts and getExpert"
  - "frontend/src/lib/api/threads.ts with setThreadActiveExpert"
  - "frontend/src/components/chat/ActiveExpertChip.tsx dismissible chip"
  - "frontend/src/components/chat/InviteExpertDialog.tsx modal expert picker"
  - "frontend/src/components/chat/MessageInput.tsx integration with 0 new top-level controls and ambient violet glow"
  - "frontend/src/components/chat/__tests__/ComposerExpert.test.tsx passing 5/5 tests"
affects: [260-03, chat, ChatArea]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero new top-level composer controls (D-260-02): invite trigger placed inside existing '+' menu"
    - "Active expert rendered in existing Using: chips container (data-testid='active-connector-chips') alongside attachments and armed connectors"
    - "Ambient violet frame glow (ring-1 ring-violet-500/30 border-violet-500/40) for active consultant state"
    - "One-click dismiss flow clearing thread active expert both locally and on backend"

key-files:
  created:
    - "frontend/src/lib/api/experts.ts"
    - "frontend/src/components/chat/ActiveExpertChip.tsx"
    - "frontend/src/components/chat/InviteExpertDialog.tsx"
    - "frontend/src/components/chat/__tests__/ComposerExpert.test.tsx"
  modified:
    - "frontend/src/types/index.ts"
    - "frontend/src/lib/api/threads.ts"
    - "frontend/src/lib/api.ts"
    - "frontend/src/components/chat/MessageInput.tsx"

key-decisions:
  - "UI budget is strictly ZERO new top-level controls on composer toolbar (D-260-02)."
  - "Invite door is placed inside '+' menu in its own clean item above connectors, keeping composer-attach-group child count intact."
  - "ActiveExpertChip mounts inside data-testid='active-connector-chips' alongside ChatAttachmentChip and ActiveConnectorChips."
  - "Dismissing chip clears threads.active_expert_id via setThreadActiveExpert(threadId, null) and returns composer to neutral styling."

patterns-established:
  - "Consultant state awareness: ambient glow on composer container visually announces active scoping without lecturing prose."
  - "Sibling chips row: Using: label appears if either connectors or an expert are active."

requirements-completed: [PACK-02]

# Metrics
duration: 18min
completed: 2026-09-20
---

# Phase 260 Plan 02 Summary: Composer Consultant Integration & Active Expert UI

**Delivered frontend composer consultant integration: `InviteExpertDialog` modal, invite trigger inside the existing `+` dropdown menu, `ActiveExpertChip` in the existing `Using:` chips container, ambient violet composer glow, and one-click dismiss flow, verified with 5/5 Vitest component tests.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-09-20T04:00:00Z
- **Completed:** 2026-09-20T04:18:00Z
- **Tasks:** 4 completed
- **Files created/modified:** 8

## Accomplishments

1. **Frontend Types and API Client (D-260-04, PACK-02)**:
   - Added `active_expert_id?: string | null` to `Thread` interface and defined `ExpertBundle` in `frontend/src/types/index.ts`.
   - Created `frontend/src/lib/api/experts.ts` (`listExperts`, `getExpert`).
   - Added `setThreadActiveExpert` in `frontend/src/lib/api/threads.ts` (`PATCH /threads/${threadId}` with `{ active_expert_id: expertId }`).
   - Re-exported domain methods cleanly from `frontend/src/lib/api.ts`.

2. **Leaf Components (D-260-02, 260-UI-SPEC §2.1, §2.2)**:
   - Created `frontend/src/components/chat/InviteExpertDialog.tsx` displaying domain expert cards with icon gems, descriptions, scope badges (`Restricted` / `Biased`), and member counts.
   - Created `frontend/src/components/chat/ActiveExpertChip.tsx` rendering `[✨ {expert.name} · {scope_mode} ✕]` with styling tokens matching the Aether Intelligence design system.

3. **Composer Integration (D-260-02, 260-UI-SPEC §2.1, §2.2)**:
   - Mounted invite door (`data-testid="invite-expert-door"`) inside the existing `+` dropdown menu.
   - Mounted `ActiveExpertChip` inside `data-testid="active-connector-chips"` with `Using:` label rendered when an expert or connectors are active.
   - Applied ambient violet glow (`ring-1 ring-violet-500/30 border-violet-500/40 shadow-[0_0_20px_rgba(139,92,246,0.12)]`) when an expert is active.
   - Zero new top-level controls added to the composer toolbar.

4. **Component Test Suite**:
   - Created `frontend/src/components/chat/__tests__/ComposerExpert.test.tsx`:
     1. Verified zero new top-level buttons on composer toolbar.
     2. Verified `+` menu reveals `"Invite Expert..."`.
     3. Verified selecting an expert mounts `ActiveExpertChip` in `data-testid="active-connector-chips"`.
     4. Verified ambient violet frame styling is applied when expert is active.
     5. Verified clicking `✕` dismisses chip, clears backend state via `setThreadActiveExpert(threadId, null)`, and restores neutral styling.
   - 5/5 tests passing in 4.0s.

## Self-Check & Verification

- `npx vitest run src/components/chat/__tests__/ComposerExpert.test.tsx`: 5 passed (100%)
- `npx vitest run src/components/chat/__tests__/ComposerAttach.composition.test.tsx`: 21 passed (100%)
- `npx tsc -p tsconfig.app.json --noEmit`: 0 new errors (exact 65 baseline preserved)
- `node scripts/check-hot-file-ledger.cjs 260`: ledger gate OK
