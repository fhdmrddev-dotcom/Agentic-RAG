---
seed_id: SEED-153
title: "Where close means WRONG — accounting period, legal entity, contract version, jurisdiction — the dimension must be a structured FILTER, never a prompt instruction, and an empty filter must FAIL the phase rather than fall back to unfiltered search"
status: planted
planted: 2026-08-12
planted_by: External review 2026-08-12 (finding F4) — accepted, and judged MORE severe than the review rated it
surface: Agentic-RAG
severity: critical
category: product / retrieval correctness / silent-failure class
priority: high
scope: Medium — a workflow-level contract binding a launch input to a retrieval filter, plus a post-gate over cited sources. Most of the parts exist; the binding does not.
affected_areas: [harness, retrieval, workflow-inputs, folder-scope, metadata-filters, validators, publish-gauntlet]
relates_to:
  - SEED-076 (filtered vector search recall + pgvector index strategy) — ADJACENT BUT NOT THIS. 076 is about whether filtered search RETURNS enough; this is about whether the filter is APPLIED AT ALL and what happens when it matches nothing.
  - SEED-146 / SEED-142 (connectors, reads) — a report assembled from an external read has the same problem one layer further out
  - SEED-152 (confidence on phase outputs) — ⚠ deliberately NOT a mitigation; see "Why no existing signal catches it"
  - SEED-114-era virtual folders / views + the view filter compiler — the most likely home for the filter half
trigger_when:
  - Any recurring/periodic reporting workflow is scoped, demoed, or sold — this is the shape that breaks
  - A customer asks for "the same report every month"
  - Scheduled runs (SEED-014) are scoped — a scheduled report is this failure on a timer
  - Any metadata dimension is proposed as a prompt instruction rather than a filter
  - SEED-076 is picked up — decide there whether the filter CONTRACT lives with it or separately
---

# SEED-153: the wrong month, cited confidently

## The failure, precisely

Ask for October's revenue. Semantic retrieval has **no concept of "wrong month"** — October revenue
and March revenue are near-identical text and score near-identically. The model receives March, cites
it accurately, and writes a fluent report.

**The result is a correct-looking, correctly-cited, WRONG report — and every quality signal in the
system reports success.**

## Why no existing signal catches it

This is the reason the seed is rated critical rather than medium:

| Signal | Why it passes anyway |
|---|---|
| **Citations** | A citation proves a number came from *a* document. It does not prove it came from the *right* document. The citation is genuine. |
| **Confidence** (`SEED-152`) | Genuinely high — retrieval genuinely *was* confident. Confidence measures similarity, and the wrong month is highly similar. **Do not treat 152 as a mitigation for this.** |
| **The strictness gate** | Checks that claims are grounded, not that the grounding is in-scope. |
| **The `freshness` validator kind** | ⚠ **This is NOT that.** Freshness is *"recent enough"*. This is *"the correct period"*, which may be twelve months old and must still pass. **Do not let the existing kind absorb the requirement** — it would look handled and be silently wrong. |
| **Evals / judge rubric** | Judges output quality. The output IS high quality. It is about the wrong period. |

Every gate this product owns is a *quality* gate. This is a *provenance-scope* failure, and quality
gates are structurally blind to it.

## The rule worth encoding as a product principle

> Where a dimension has the property that **close means wrong** — accounting period, legal entity,
> contract version, jurisdiction, employee, matter, fiscal year — that dimension MUST be a
> **structured filter**, never a prompt instruction. And an empty filter result MUST **fail the
> phase**, never fall back to unfiltered search.

The second clause is as important as the first. A filter that silently degrades to "search
everything" when it matches nothing reproduces the exact defect it was added to prevent, and does it
at precisely the moment the data is missing — which is when the answer matters most.

## What exists, and what is actually missing

**Exists:** document metadata fields; classification rules; virtual folders and saved views; a view
filter compiler; `folder_scope` per phase; `kb_auto` source typing on workflow inputs; `SEED-076` on
filtered-search recall.

**Missing — the whole seed:**
1. a **binding** from a launch-form input to a retrieval filter for a phase (folder scoping exists;
   whether an arbitrary metadata dimension can be bound the same way is **unverified**), and
2. a **post-gate** asserting every cited source falls inside the requested window, and
3. the **fail-closed** rule on an empty filter.

## What a customer can do afterwards that they cannot do now

Run "the monthly report" every month and trust it without re-checking every figure by hand. That is
the difference between a workflow they run once as a demo and a workflow they run forever — which is
also why the defect compounds rather than being caught once.

## What breaks or embarrasses us without it

This is the failure that **loses a customer rather than annoying one**, and it is silent: nobody files
a bug, they just quietly stop trusting the product. It also lands directly on the claim being sold —
a governance-differentiated product that confidently cites the wrong quarter is worse positioned than
one that never claimed governance.

⚠ **It is currently a reason NOT to sell recurring financial/board reporting**, which is otherwise the
highest-value shape the workflow product can serve. Pair with attachments (`SEED-146`): a report that
cannot be delivered and might be about the wrong month is two blockers on the same use case.

## Open questions

1. **Can a workflow input reach retrieval as a metadata filter today at all?** `folder_scope` proves
   *folder* scoping exists. Arbitrary dimensions are unverified — **check this first; it sets the
   size.**
2. **Who declares a dimension "close means wrong"?** Per-workflow author choice, a KB-level property
   of the metadata field, or a fixed list? A field-level property is the most reusable and the least
   author-dependent.
3. **Does the publish gauntlet enforce it?** A workflow that reads a period from an input and does not
   bind it to a filter is arguably unpublishable — that would make this structural rather than
   remembered, the shape this codebase already prefers.
4. **What does the failure look like to a user?** "No documents matched October 2026" is honest and
   actionable. Silence, or a report built from March, is neither.

## Confidence in this seed

**The reasoning is verified against how the stack works; the code paths are not.** No file was read to
confirm which of the existing filter mechanisms could carry the binding. `SEED-076` is confirmed
`planted` and is about recall rather than this contract. Size the work only after open question 1 is
answered.

## Related

[[SEED-076]] (adjacent, not the same) · [[SEED-152]] (explicitly NOT a mitigation) · [[SEED-146]] ·
[[SEED-014]]
