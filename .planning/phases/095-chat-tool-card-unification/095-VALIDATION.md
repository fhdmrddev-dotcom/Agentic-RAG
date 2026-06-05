---
phase: 095
slug: chat-tool-card-unification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 095 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `095-RESEARCH.md` → `## Validation Architecture`. Per-task map is populated by the planner.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (frontend)** | vitest 4.1.0 + @testing-library/react 16.3 + vitest-axe 0.1.0 |
| **Framework (backend, D-08 tag)** | pytest (backend `venv`) |
| **Config file** | `frontend/vitest.config.*` (run via `package.json` "test") |
| **Quick run command (frontend)** | `cd frontend && npx vitest run src/components/chat/RunCard.test.tsx` (per-file) |
| **Quick run command (backend)** | `cd backend && venv pytest backend/tests/test_095_final_output_tag.py` |
| **Full suite command** | `cd frontend && npm test` (`vitest run`) |
| **Estimated runtime** | ~30–90s per-file; full frontend suite ~minutes |

---

## Sampling Rate

- **After every task commit:** Run the relevant per-file vitest run (or backend pytest for the D-08 tag task)
- **After every plan wave:** Run `cd frontend && npm test` — full suite green
- **Before `/gsd-verify-work`:** Full suite green + the 4 Chrome-DevTools MCP lived-experience UAT scenarios pass (G-4 / SC#10 4-axis)
- **Max feedback latency:** ~90 seconds (per-file)

---

## Per-Task Verification Map

> Populated by the planner. Each task maps to a Dimension-8 automated verify (or a Wave-0 stub dependency).
> Source rubric — `095-RESEARCH.md` Per-Decision Validation Map:

| Decision | Behavior | Test Type | Pass condition |
|----------|----------|-----------|----------------|
| D-01 collapse | Terminal+tools run mounts COLLAPSED; click expands; one-line essence | unit (RunCard.test.tsx) | collapsed row rendered; body toggles on click |
| D-02 focus mode | Only active step open; finished fold to summary | component (ToolCallPanel.test.tsx) | hiddenStepsCount≥3 → summary rows; active expanded |
| D-03 follow-scroll | Follow at bottom; release on scroll-up; re-arm; Jump-to-live | component (NEW useFollowScroll test) | scroll-up→isPinned=false+pill; scroll-bottom→isPinned=true+pill hidden |
| D-04 unified count | RunCard label == panel count == collapsed "N steps" | unit (NEW stepCount.test.ts + RunCard.test.tsx) | all three read `unifiedStepCount(msg)` == deduped length |
| D-05 zero-dup | One card per logical sub-agent task; no duplicate | unit (StreamsProvider.dedup.test.ts ext) | exactly ONE SubAgentBlock for tool_start + sub_agent_* of same task |
| D-06 persistent timer | Visible whole run; freezes at TRUE terminal; survives transient stream_end + remount | unit (RunCard.test.tsx) | timer present when start-time exists regardless of elapsedMs/isStreamingNow |
| D-07 hero file | Hero block above collapsed working group; all downloadable | component (MessageItem.finalOutputs.test.tsx ext) | hero card separate from working group; download affordance when url present |
| D-07 dead-link (no url) | url-less file → no silent dead anchor | unit (MessageItem.finalOutputs.test.tsx) | download works OR affordance clearly disabled |
| D-08 tag (backend) | Agent loop emits final_output_files with hero tag; persists into result for reload | unit (NEW test_095_final_output_tag.py) | tag field present in emit + persisted execute_code result |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

NEW test files / stubs (framework already installed — no install step):

- [ ] `frontend/src/lib/stepCount.ts` + `stepCount.test.ts` — `unifiedStepCount` + shared dedup extraction (D-04)
- [ ] NEW `useFollowScroll` hook test — D-03 state machine (follow/release/re-arm/jump)
- [ ] `backend/tests/test_095_final_output_tag.py` — D-08 emit/persist of the hero tag + backend fallback
- [ ] EXTEND `frontend/src/components/chat/RunCard.test.tsx` — D-06 timer-survives-transient + D-04 unified label
- [ ] EXTEND `frontend/__tests__/providers/StreamsProvider.dedup.test.ts` — D-05 sub-agent single-render
- [ ] EXTEND `frontend/__tests__/components/MessageItem.finalOutputs.test.tsx` — D-07 hero/working split + url-less

---

## Manual-Only Verifications

The 4 lived-experience UAT scenarios (Chrome-DevTools MCP — wire format + screenshot insufficient, G-4):

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Long run stays honest | CHAT-04 / SC#2 | Needs a real long multi-step run to observe timer never vanishing + count==cards + no sub-agent dup | Kimi/Moonshot ~11-step PPTX build; watch timer continuous, step count == cards, read/summarize never doubles, freeze at true terminal |
| Multi-tool stays calm | CHAT-04 / SC#1 | Needs live streaming + scroll behavior | One prompt → `search_documents` + `execute_code`; both share frame, finished folds, active open + auto-scroll follows |
| Hero file downloads (incl. next-day) | CHAT-04 / SC#3 | Needs real file generation + re-sign path + next-day reopen | Ask for a `.docx`; hero is the doc, one-click download; reopen chat next day → download still works |
| Two threads + 6-provider parity | CHAT-04 / SC#3+SC#4 | Needs parallel streaming + cross-provider sweep | Thread A streaming while Thread B accepts a prompt; no cross-bleed; unified frame identical across all 6 native providers |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
