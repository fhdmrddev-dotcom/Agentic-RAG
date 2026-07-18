# Phase 153: Inline Citations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 153-inline-citations
**Areas discussed:** Marker integrity rules, Cross-provider floor, What counts as a source, Default-on & Deep parity

**Pre-discussion context:** The look-and-feel was already locked by two operator-approved
sketches (074-A superscript chip + absence-as-signal; 075-A hover-peek→pin + numbered `[n]`
References footer), so G-2 was already satisfied. This discussion focused only on the
remaining truth-rules and boundaries. Reported-bugs cross-check: no open `surface:
Agentic-RAG` report overlaps the inline-citation / MessageItem-render domain — nothing folded.

---

## Marker integrity rules (set-membership)

| Option | Description | Selected |
|--------|-------------|----------|
| Strip non-members | Backend validates each marker against the finalized retrieval set, removes any that don't map to a real source, renumbers survivors 1..k to match the footer. Never renders a broken/fabricated attribution. | ✓ |
| Render inert (greyed) | Keep the broken marker visible but non-linking so the reader sees the model 'tried' to cite. | |
| Keep + flag ⚠ | Show an 'unverified' warning marker. | |

**User's choice:** Strip non-members.
**Notes:** Also settled the false-negative case — a grounded claim the model forgot to
mark stays unmarked, no re-ask backstop (Pitfall 14). Derived: backend is the single source
of truth for numbering; validate/renumber happens at settle (the `citations` SSE finalize
point), coinciding with 074's attach-on-settle behavior.

---

## Cross-provider floor (SC#10)

| Option | Description | Selected |
|--------|-------------|----------|
| Footer always, inline-if-emitted | When retrieval ran, always show the numbered References footer; inline markers appear only when the model emitted valid ones. Non-compliant models degrade to footer-only. No provider worse than today. | ✓ |
| All-or-nothing | No inline markers → hide citation UI entirely (current behavior). | |
| Auto-append [1..k] | Synthesize markers at the answer's end. | |

**User's choice:** Footer always, inline-if-emitted.
**Notes:** Explicit cross-provider floor — richer on strong models, never poorer than
today's sources list on weak ones.

---

## What counts as a source (scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Deep: chunk + full-doc | search_documents chunks AND full-doc/fetched-file reads (is_full_doc, Phase 151) both cite; whole-doc citation shows a 'full document → Open' peek. Workflow llm_emit keeps its citation_policy gate, not retrofitted. | ✓ |
| Chunk search only | Only search_documents chunks cite; fetched/whole-doc grounding shows no marker. | |
| Everything incl. workflows | Also retrofit workflow llm_emit answers. | |

**User's choice:** Deep: chunk + full-doc (workflow out of scope).
**Notes:** Workflow-mode inline citations captured as a deferred idea with a re-open trigger.

---

## Default-on & Deep parity

| Option | Description | Selected |
|--------|-------------|----------|
| Always-on, no toggle | On whenever retrieval ran (Glean/Beam pattern); citation instruction added additively only on retrieval turns, so Deep stays byte-identical elsewhere. | ✓ |
| Setting, default on | A Settings switch to turn citations off. | |
| Setting, default off | Opt-in. | |

**User's choice:** Always-on, no toggle.
**Notes:** Honors the D-14 red line — additive, retrieval-turns-only, no shared-path fork.

---

## Claude's Discretion

- Exact numbering mechanism handed to the model (per-result IDs vs. numbering the final
  set) — strip+renumber-to-footer makes any reasonable mechanism safe.
- Backend vs. frontend split of marker parse/validate + the exact SSE contract.
- Marker-density prompt wording ("load-bearing facts only").
- Full-doc peek exact copy.

## Deferred Ideas

- Inline citations on workflow `llm_emit` answers (re-open: dedicated workflow-citations
  phase or user demand).
- A user setting to disable citations (rejected; re-open: real reports it's unwanted).
