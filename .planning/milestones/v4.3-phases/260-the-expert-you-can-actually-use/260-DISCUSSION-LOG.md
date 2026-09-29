# Phase 260: The Expert You Can Actually Use - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 260-the-expert-you-can-actually-use
**Areas discussed:** Thread Persistence & Wire Channel, Action Tile Interaction, Financial Analyzer Seeding & Test Documents.

---

## Area 1: Thread Persistence & Wire Channel

| Option | Description | Selected |
|--------|-------------|----------|
| Durable persistence in `threads` table (Migration 188) | Migration 188 adds `active_expert_id uuid REFERENCES expert_bundles(id)` to `public.threads`. Survives refresh, tab changes, and cross-device sessions. Seamlessly clears on dismissal. Scoping resolved prior to agent loop into `RunContext` as data | ✓ |
| Ephemeral frontend session state | Active expert stored solely in React state and passed in message creation payload. Drops consultant on refresh or navigation | |

**User's choice:** Durable persistence in `threads` table (Migration 188).
**Notes:** D-260-04 and D-260-05 locked. Fulfills the `D-259-07` consultant model without violating the closed-core red line.

---

## Area 2: Action Tile Interaction Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate 1-click send | Tapping a "Try asking…" tile immediately posts the question and triggers the agent run for frictionless onboarding | ✓ |
| Populate composer textarea | Fills textarea and focuses for user review/customization before sending | |
| Hybrid | Direct tap sends immediately; small edit icon copies into composer for tweaking | |

**User's choice:** Immediate 1-click send.
**Notes:** D-260-06 and D-260-07 locked. Matches the operator mandate for simplicity, responsiveness, and minimal friction.

---

## Area 3: Financial Analyzer Seeding & Test Documents (PACK-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Seed real financial folder & 10-K filing in Migration 188 | Migration 188 creates a system financial knowledge folder with real 10-K/earnings report fixture, populating `knowledge_folder_ids` in `financial-analyzer` and bundling ratio calculation skills | ✓ |
| User-bound folder | Requires user to upload or attach documents before the Analyzer can answer | |

**User's choice:** Seed real financial folder & 10-K filing in Migration 188.
**Notes:** D-260-08 and D-260-09 locked. Solves the seed gap identified in Phase 260 handover and enables `PACK-05` to pass end-to-end out of the box.

---

## Claude's Discretion

- Ambient violet composer glow token styling.
- Specific icon pairing for action tiles (`📈`, `⚖️`, `💵`).
- Dataclass field layout for `RunContext` scoping inputs.

---

## Deferred Ideas

- App URL Router (`/experts/<slug>`) deferred to a dedicated routing infrastructure phase.
- User-authored expert builder and public catalog directory deferred to Phase 261 / post-v4.3.
