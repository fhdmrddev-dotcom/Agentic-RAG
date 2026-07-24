# Phase 174: Run-State & Lifecycle Honesty - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 174-run-state-lifecycle-honesty
**Mode:** Autonomous (`--auto` semantics — operator left unattended, "select best options"). Every gray area resolved to the recommended option, grounded in a live code scout + operator-approved sketches 129-C / 130-C.
**Areas discussed:** STATE-01a/02 verify-vs-rebuild, STATE-01b treatment, STATE-03 mechanism, STATE-04 approach, G-5/SC#10 cross-cutting

---

## STATE-01a + STATE-02 — Verify-first vs rebuild

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild the cancelled/stopped render + reload derive from scratch | Treat as BUILD; re-author the render conditions and hydration | |
| Verify-first, surgical-fix-only-if-a-gap-is-found | Scout confirms render conditions (MessageItem.tsx:627/:670) AND cold-reload hydration (threads.py:346-353 + api.ts:198) both exist; run live cross-provider + reload UAT; patch only a proven gap | ✓ |

**Choice:** Verify-first. **Notes:** Live scout (2026-07-22) proved `runStatus` IS re-derived from persisted `runs.status` on cold reload — the SPEC's open question resolves to "yes" at the data level. Highest-probability residual gap flagged (D-03): the run-join populating `run_status='cancelled'` for the empty (content_len=0) early-cancel row (DeepSeek `64cebee7`). Do not churn working code.

---

## STATE-01b — Killed-workflow 403 treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the existing per-thread reconcileErrors banner + rollback | The current non-409 ApiError path (StreamsProvider:2069) drops both bubbles + shows a banner | |
| In-chat AMBER administrative-block bubble (sketch 129-C) | New targeted catch branch: replace the empty placeholder with an amber "disabled by the administrator" bubble carrying ApiError.message + clear the workflow-lock | ✓ |
| Red error bubble | Treat the 403 as a failure (red framed) | |

**Choice:** Amber in-chat block (129-C). **Notes:** A kill-switch 403 is an *administrative block*, not a failure — 129-C's amber tier. Reuse the existing amber `model-fallback-notice` styling (MessageItem:467). Scope guard (D-05): the existing Deep 400/409 rollback-banner path stays byte-identical; STATE-01b is a new, narrower branch keyed to the workflow-launch 403.

---

## STATE-03 — Pre-answer honesty mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Count reasoning + tool-args activity in outerBannerLabel (render-derive) | Extend toolMeta.ts:68 to surface "Reasoning…" from already-stamped message.reasoningContent + tool_args_progress, per sketch 130-C run-header sub-state | ✓ |
| Add a new backend "activity" SSE event | Emit a dedicated pre-answer activity event | |
| Also fix the latency causes (title-gen async, sandbox pre-warm) | Shorten the wait, not just label it | |

**Choice:** Render-derive from already-emitted events (130-C). **Notes:** Frontend-only, Deep byte-identical, no backend latency work. Cross-provider research flag (D-09): confirm the reasoning signal fires for Kimi/Moonshot + GLM, not DeepSeek-only. Latency causes 2/3 explicitly deferred (honest-label only).

---

## STATE-04 — Timer anchor + avatar dedupe

| Option | Description | Selected |
|--------|-------------|----------|
| Anchor timer to started_at (reuse 095.1) + dedupe the double-mount avatar | Extend the Phase 095.1 Deep-card started_at anchor to the workflow strip; resolve the StreamsProvider/MessageList double-mount for a single avatar | ✓ |
| Timer only | Fix the reseed, leave the avatar | |

**Choice:** Both (SPEC-locked STATE-04 = timer + avatar). **Notes:** Backend already correct (DB-confirmed 1 assistant row/run) — pure frontend reconcile fix. Reuse the 095.1 pattern for the timer; dedupe at the MessageList key/reconcile seam.

---

## Cross-cutting — G-5 / SC#10 / design bar

| Option | Description | Selected |
|--------|-------------|----------|
| Refactor-first (G-5) before the feature | Insert a refactor phase on the hot files first | |
| Proceed — additive render-layer only; threads.py extraction paid down in 162.5 | G-5 audit → no refactor-first; changes additive at the render seam; G-2 satisfied by 129-C/130-C | ✓ |

**Choice:** Proceed (D-13). **Notes:** SC#10 4-axis live UAT mandatory (DeepSeek required for STATE-01a); authored under VALIDATION.md. Design bar = operator-approved 129-C + 130-C.

---

## Claude's Discretion

- Exact discriminator for the STATE-01b amber branch (403 status + workflow-locked send) — researcher/planner confirms.
- Which run-strip component owns the workflow timer (vs the 095.1-fixed Deep run-card) — researcher confirms before extending the anchor.
- Optional STATE-03 polish (reasoning-token count + elapsed alongside the label) — nice-to-have, not required for acceptance.

## Deferred Ideas

- Title-gen serial→async (BUG-260607-02 cause 2) — backend latency, future phase.
- Sandbox cold-start pre-warm/pool (cause 3) — infra/SEED.
- OpenRouter-specific run-state failures — experimental provider, out of SC#10.
- Panel-side run-honesty (BUG-260609-02/-04) — workflow-run-display cluster, candidate STRETCH 178, not folded here.
- `spike-nl-workflow-authoring` todo — keyword false-positive (v3.6 NL authoring), reviewed, not folded.
