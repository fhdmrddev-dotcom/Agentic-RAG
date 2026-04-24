# Phase 39: User Feedback Loop — Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 39 - User Feedback Loop — Backend
**Areas discussed:** Feedback mutability, Positive rate window, Audit action_type naming, Most-downvoted document attribution

---

## Feedback Mutability

| Option | Description | Selected |
|--------|-------------|----------|
| Truly permanent | No DELETE/PUT endpoint; UNIQUE(message_id, user_id); one rating ever | ✓ |
| Retractable (soft-delete) | Users can DELETE their own rating and re-submit once | |
| Re-submittable (upsert) | POST upserts — second submission replaces first | |

**User's choice:** Truly permanent  
**Notes:** Simplest schema — no soft-delete column needed. 409 Conflict if already rated.

---

## Positive Rate Window

| Option | Description | Selected |
|--------|-------------|----------|
| All-time positive rate | Total thumbs-up / total ratings ever | ✓ |
| 30-day positive rate | Rolling window consistent with most-downvoted docs | |

**User's choice:** All-time positive rate  
**Notes:** Stable baseline signal. Most-downvoted documents still use 30-day window.

---

## Audit Action_Type Naming

| Option | Description | Selected |
|--------|-------------|----------|
| feedback.submit | Follows dotted namespace convention (search.query, memory.remember) | ✓ |
| message_feedback | Verbatim from success criteria; breaks dot convention | |

**User's choice:** feedback.submit  
**Notes:** Consistent with existing VALID_ACTION_TYPES naming pattern.

---

## Most-Downvoted Document Attribution

| Option | Description | Selected |
|--------|-------------|----------|
| All cited documents | Spread downvote across every doc in source_refs | ✓ |
| RAG-only messages | Only attribute when source_refs is non-empty | |
| No document attribution | Skip doc-level attribution; stats shows rate only | |

**User's choice:** All cited documents  
**Notes:** Captures all potentially-at-fault documents. Messages with empty source_refs are implicitly excluded since there are no documents to attribute to.

---

## Claude's Discretion

- Postgres ENUM vs VARCHAR+CHECK for rating/reason columns
- Python-side vs Supabase RPC for top-5 aggregation
- 409 Conflict error response format
