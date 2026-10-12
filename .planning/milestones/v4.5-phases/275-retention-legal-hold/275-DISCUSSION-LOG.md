# Phase 275: Retention & Legal Hold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 275-retention-legal-hold
**Areas discussed:** Delete gate + SC#3 wording, Hold reach (every path), Archive + what "findable" means, The policy clock

Pre-answered by sketch 275 (operator, 2026-10-12): 1B sub-tabs, 2B Preview-gated form, 3A batch + type-the-count, 4B Library chips + folder line; named matters; fail-closed states.

---

## Register routing

| Item | Selected |
|---|---|
| SEED-250 — retention is the one absent DMS capability | ✓ folded |
| BUG-261004-01 — search serves documents deleted/unshared at source | ✓ folded |
| SEED-345 — per-org retention + rate limits | ✓ partially answered (documents half) |
| Todo `spike-nl-workflow-authoring.md` (keyword-only match) | not folded |

## Delete gate + SC#3 wording

| Question | Options | Selected |
|---|---|---|
| How should SC#3 read? | Reword to match / Per-policy auto-delete toggle / Keep SC#3 as written | Reword to match |
| What does 'review' do? | Waiting for you, 3 choices / Notify only / Drop review | Waiting for you, Keep/Archive/Delete |
| When does a kept doc come back? | When something changes / Next sweep / After one more full period | When something changes |
| What does a confirmed delete remove? | Everything; receipt stays / Soft delete + purge later / Latest version only | Everything; receipt stays |

## Hold reach (every path)

| Question | Options | Selected |
|---|---|---|
| Where is the hold enforced? | Database refuses + app explains / App checks at each path | Database refuses + app explains |
| Folder delete with a held doc? | Refuse the whole delete / Delete the rest, keep held ones | Refuse the whole delete |
| Freeze or stop deletion only? | Stops deletion only / Freezes it | Stops deletion only |
| Member sees matter name? | Hide / Show | Hide |

## Archive + what "findable" means

| Question | Options | Selected |
|---|---|---|
| Which surfaces hide archived? | All agent paths; Library toggle / Chat search only | All agent paths; Library toggle |
| Un-archive? | Admins can; then left alone / One-way / Anyone who can edit | Admins can; then left alone |
| Two-stage schedules? | Optional second stage / One action per policy | Optional second stage |
| Deleted-at-source docs in chat search? | Excluded, chip in Library / Kept, with a badge | Excluded, chip in Library |

## The policy clock

| Question | Options | Selected |
|---|---|---|
| Clock date? | Policy picks; no fallback / Document date only / Date added only | Policy picks; no fallback |
| Subfolders? | Yes; nearest folder wins / Yes; any two disagree → nothing / This folder only | Yes; nearest folder wins |
| Folder + class overlap? | Nothing happens (sketch rule) / Longest keep wins | Nothing happens |
| Versions? | Together, by the latest / Each on its own clock | Together, by the latest |

## G-4 scenarios

Proposed HOLD / LIFECYCLE / MEMBER scenarios — **accepted all 3**.

## Claude's Discretion

- Where the archived/source-state exclusion is enforced (RPC vs Python seam) — measure first.
- Archive/hold table shapes; class picker from live type distribution; any org admin may confirm; nightly sweep cadence; folder-delete audit row.

## Deferred Ideas

- Four-eyes delete approval; soft-delete grace window; chat/message retention + rate limits (SEED-345 rest); watch purge endpoints orphan storage bytes; artifacts copies not reached by disposition; storage cleanup on user deletion.
