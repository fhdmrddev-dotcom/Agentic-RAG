# Phase 067: Frontend Streaming-UX Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 067-frontend-streaming-ux-fix
**Areas discussed:** First-paint posture, Mid-stream UI state semantics, Tool-call iteration boundary visual, SC#6 protocol re-run + scope edges

---

## Gray Area Selection (entry)

The four gray areas surfaced from analysis of the 5 carry-forward UX issues (UX-067-01..05) plus Phase 066's deferred SC#6.

| Area | Description | Selected |
|------|-------------|----------|
| First-paint posture (UX-067-01/03) | Surgical bug-patch vs structural cleanup of streaming-attach lifecycle | ✓ |
| Mid-stream UI state semantics (UX-067-02) | When/whether to show "Saving response…" or similar mid-stream indicators | ✓ |
| Tool-call iteration boundary visual (UX-067-05) | Subtle dividers vs collapsible sections vs no marker | ✓ |
| SC#6 protocol re-run + scope edges | Inline vs separate UAT pass; stopgap removal; live-tooling rule | ✓ |

**User's choice:** All four areas selected.
**Notes (verbatim addendum):** "you have also access to supabase CLI, chrome MCP, langsmith MCP, you should use them when needed to confirm everything is working 100%" — captured as D-067-07 (live-tooling verification rule, phase-wide).

---

## Area 1 — First-paint posture (UX-067-01 / UX-067-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Architectural cleanup (Recommended) | Treat streaming-attach lifecycle as root cause; unify SSE attach + placeholder + reconcile-on-mount in one well-ordered state machine | ✓ |
| Surgical race patch | Find the specific race, patch it, validate with Chrome MCP — smaller diff, lower confidence | |
| Researcher decides | Defer posture choice to gsd-phase-researcher | |

**User's choice:** Architectural cleanup
**Notes:** Aligns with the user's prior direction "we should not care about the budget but we care about accuracy, performance and failure-free execution" (Phase 066). Researcher attacks root pattern; surgical patch posture explicitly rejected to avoid second-race resurfacing.

---

## Area 2 — Mid-stream UI state semantics (UX-067-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Match Claude/ChatGPT — nothing extra (Recommended) | Delete "Saving response…" fallback; banner only on terminal states | ✓ |
| Keep "Saving response…" but tighten timing | Show only between SSE-end and Postgres persist | |
| Replace with typing/working pulse during stream | Drop "Saving response…", add subtle pulse during true streaming | |

**User's choice:** Match Claude/ChatGPT — nothing extra
**Notes:** No mid-stream chrome. Banner reserved for terminal states (cancelled / timed_out / failed). Fix surface = tighten runStatus state machine so terminal value is set correctly on every code path AND the unguarded terminal-flip in useMessages.ts:561-589 is brought under the same thread-match guard as the delta callbacks.

---

## Area 3 — Tool-call iteration boundary visual (UX-067-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle "Step N" divider (Recommended) | Thin gradient divider with small label between iterations; matches Aether Intelligence | ✓ |
| Collapsible iteration sections | Each iteration is a collapsible card with summary header | |
| No marker — spacing + group headers | Vertical breathing room only; no Step N label | |
| Defer to /gsd:ui-phase | Generate UI-SPEC.md before implementing | |

**User's choice:** Subtle "Step N" divider
**Notes:** Preview-confirmed visual (gradient horizontal rule with `Step 2` / `Step 3` labels between tool-call groups). `onIterationStart` callback already fires per backend event — the rendering plumbing in ToolCallPanel.tsx is the only gap.

---

## Area 4 — SC#6 protocol re-run + scope edges

| Option | Description | Selected |
|--------|-------------|----------|
| Inline SC#6 re-run as 067's closing UAT (Recommended) | Re-run Phase 066 Plan 05 Task 2 protocol once UX-067-01..05 are live; close the loop without separate UAT | ✓ |
| Remove RUN_HARD_TIMEOUT_SECONDS stopgap (Recommended) | Delete obsolete env var line; folded into 067 as one-line task | ✓ |
| Use Chrome MCP + Supabase CLI + LangSmith MCP throughout | Live-tooling verification REQUIRED, not optional, for executor and verifier | ✓ |

**User's choice:** All three folded into Phase 067 (multi-select).
**Notes:** Live-tooling rule promoted to D-067-07 with explicit binding for executor + verifier (each Success Criterion's `<verify>` block must cite which MCP tool gates it).

---

## Claude's Discretion

- Exact divider styling tokens (color, gradient direction, font weight, padding) — pick from existing Aether Intelligence design tokens; propose 2-3 variants in plan-phase if no clean match exists.
- Whether the FIRST iteration renders without a "Step 1" divider above it (cleanest visual: dividers BETWEEN iterations only).
- Whether to extract the new state machine into a separate hook (preferred: keep inline unless diff exceeds ~150 lines).
- Whether D-067-06 (stopgap removal) lands as its own commit or folded into another plan's cleanup.
- `failed`-state banner copy refinements (e.g., truncating long `runs.error` strings).

## Deferred Ideas

- Collapsible iteration sections — re-open if flat dividers prove insufficient on 6+ iteration runs.
- LLM-generated step summaries (e.g. "Step 2 — generating charts") — re-open if generic "Step N" label proves too sparse.
- `/gsd:ui-phase 067` full UI design contract — re-open if D-067-03 implementation surfaces design ambiguity beyond Claude's discretion.
- Iteration-boundary collapse-on-completion — re-open if long runs become unreadable scroll surfaces.
- Backend SSE emission audit (`runStatus` transitions emitting events) — re-open if D-067-02 tightening surfaces a backend-emission gap.
- Persistent-state indicator ("Saving…" between SSE-end and Postgres persist) — re-open if users report a message-vanishing-briefly UX bug post-067.
- Explorer-mode iteration UI — D-067-03 default targets General mode; verify Explorer compatibility in plan-phase.
