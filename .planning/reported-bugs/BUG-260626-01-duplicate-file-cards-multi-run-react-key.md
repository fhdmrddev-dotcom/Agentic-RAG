---
id: BUG-260626-01
title: Generated-file cards duplicate + search source-docs bleed in multi-run chat threads (frontend duplicate React key)
reported: 2026-06-26
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/streaming, frontend/chat-render]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 06ae19dc
  date: 2026-06-26
---

# BUG-260626-01: Duplicate generated-file cards in multi-run threads (duplicate React key)

## Resolution (fix committed + unit-verified — pending lived multi-run re-test before close)

Fix landed on `develop` in commit **`2a48fea4`** (2026-06-26). All three proposed
steps applied verbatim:
1. `MessageList.tsx` — dedup the messages array by `runId` before `.map()`,
   preferring the persisted (non-`temp-`) row (order-preserving; no-op for single
   runs / no-runId rows).
2. `StreamsProvider.tsx` — both keep-predicates (reconcile + `loadMessages`) now
   require `&& !dbRunIds.has(m.runId)` on the subscription arm; harness path
   confirmed unaffected (its persisted answer returns `runId=undefined`).
3. `MessageList.dedup.test.tsx` — 5 regression cases (one-row-per-runId,
   persisted-preferred either order, lone-streaming-temp preserved,
   different-runId NOT collapsed, no-runId rows untouched).

Verified: `npx vitest run` (14/14 green across both MessageList test files) +
`npx tsc --noEmit` (exit 0). **Status stays `open`** until the Phase 123 SC#10
Axis-2 multi-tool/multi-run scenario is re-run live and the rendered screen is
confirmed (1 card / 1 GENERATED FILES header per run, zero duplicate-key console
warnings) — wire+unit green ≠ screen correct (the lesson that found this bug).

## What we observed

In a chat thread with **more than one run**, a prior turn's "GENERATED FILES" panel and its output-file card render **multiple times**, and search-result source documents bleed into the generated-files block.

Concrete, live-captured (thread `13ae9bfe`, 2 runs):
- DOM had `Weekly_Report_2026-06-25.docx` as a **file card 4×** and **4 "GENERATED FILES" headers**, where the thread produced 2 files across 2 runs (expected ~2).
- KB source docs (`FMrad_FT_Approved_06062026.docx`, `Fahed Mrad Chapters 1 to 4.docx`, `Chapter_5_Full_Draft (4).docx`) appeared intermixed inside the generated-files blocks.
- **Browser console smoking gun (preserved):** `Encountered two children with the same key, run-89125149-3a2f-43c2-8d2e-1f05a9d3d4e9. Non-unique keys may cause children to be duplicated and/or omitted [273 times]`.
- The DB (`public.messages`) is **clean**: one assistant message per turn, each with exactly one `final_output_files` / one `execute_code` output file.
- **Does NOT reproduce on a single clean run** (verified: 1 card, 1 header). **Self-heals on thread-switch / reload** (the reconcile drops the stale temp).

## Why it matters

The core chat surface visibly duplicates the agent's output deliverables during normal multi-turn use, and mixes in unrelated KB documents — it reads as broken/untrustworthy even though the data is correct. It self-heals on reload, so it's not data loss, but it's a prominent lived-experience defect on the most-used surface. Found during Phase 123 SC#10 multi-tool UAT.

## Hypothesized cause

**FINDING (not hypothesis) — adversarially verified, high confidence.** Frontend duplicate-React-key collision:
- `frontend/src/components/chat/MessageList.tsx:167` keys assistant rows by `` `run-${msg.runId}` ``.
- In a multi-run thread's live / just-after-terminal window, the chat bucket transiently holds **two messages with the same `runId`**: the in-place-completed `temp-…` placeholder AND the persisted/reconciled real-uuid row. Both render under the identical key → React duplicates/omits subtrees → the message's `FinalOutputsPanel` + `OutputFileCard` render multiple times and sibling fields (`sources`) bleed in.
- The temp survives because the keep-predicates in `StreamsProvider.tsx` reconcile (`1340-1365`) and `loadMessages` (`2061-2083`) retain a runId-bearing temp while `subscriptionsRef.current.has(m.runId)`, and the transient-`done`→reattach path (`~1752-1768`) re-adds `runId` to `subscriptionsRef`. Most reliably triggered by a transient-`done`-with-active-tools (multi-tool runs — the search+task+execute_code shape).
- Backend is **not** at fault for this symptom (DB clean; Phase-120 baseline harvest per-run-clean).

Key files: `MessageList.tsx:167`, `StreamsProvider.tsx:2061-2083`, `StreamsProvider.tsx:1340-1365`, `MessageItem.tsx:73-84,558-560`.

## Surface classification

`Agentic-RAG` — this app's frontend chat render. Routing candidate.

## Suggested routing

- **Fold into in-flight phase:** candidate refactor/fix phase on the chat-render hot files (MessageList/StreamsProvider/MessageItem are on the G-5 ledger).
- **Defer to future phase / milestone:** n/a — fix is small + verified; recommend prompt fix.
- **Plant as seed:** n/a
- **External — note only:** no

## Proposed fix (frontend-only, shared-path-safe — D-14 intact)

1. **PRIMARY (must-have):** in `MessageList.tsx`, dedup the messages array by `runId` immediately before `.map()`, preferring the **persisted (non-`temp-`) row** over a same-runId temp. Keep the existing `` key={msg.role==='assistant' && msg.runId ? `run-${msg.runId}` : msg.id} `` so the temp→persisted swap stays remount-free.
2. **SECONDARY (root hardening):** tighten the keep-predicate in BOTH `loadMessages` and `reconcile` so a temp is dropped once its persisted twin is present — add `&& !dbRunIds.has(m.runId)` to the subscription clause ("keep the temp only while the DB hasn't returned its runId yet"). NOTE: verify harness double-answer-on-reload is not reintroduced (harness runs return `runId=undefined`, so this clause is a no-op for harness — the `runStatus==='streaming'` arm still governs harness temps).
3. Add a regression test: a bucket holding BOTH a temp and a persisted message with the same `runId` renders exactly ONE `FinalOutputsPanel`.

## Workarounds

Reload / switch threads — the render self-heals on the next clean reconcile.

## Reference / evidence links

- Root-cause workflow run `wf_cf429301-479` (locate:dup + verify:dup, both agree, high confidence).
- Console: duplicate-key warning ×273 for `run-89125149-…`.
- Live DOM after thread-switch: 3 messages / 3 panels / 1 card each (self-healed).
