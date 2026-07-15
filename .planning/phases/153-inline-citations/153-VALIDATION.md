---
phase: 153
slug: inline-citations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 153 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `153-RESEARCH.md` §"Validation Architecture". The Per-Task
> Verification Map is scaffolded here and finalized against the PLAN.md task IDs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: pytest (`asyncio_mode=auto`, `testpaths=tests`). Frontend: vitest + jsdom + Testing Library. |
| **Config file** | `backend/pytest.ini`; `frontend/vitest.config.ts` (setup `src/setupTests.ts`) |
| **Quick run command** | Backend: `cd backend && venv/Scripts/python -m pytest tests/unit/test_153_citation_markers.py -x` · Frontend: `cd frontend && npx vitest run src/components/chat/__tests__/CitedMarkdown.test.tsx` |
| **Full suite command** | Backend: `cd backend && venv/Scripts/python -m pytest tests/unit -q` · Frontend: `cd frontend && npm test` (`vitest run`) + `npx vite build` |
| **Estimated runtime** | Backend touched-surface ~10s; frontend touched-surface ~15s; vite build ~30s |

---

## Sampling Rate

- **After every task commit:** Run the touched-surface quick suite (the new backend marker test OR the touched frontend component test).
- **After every plan wave:** Backend `pytest tests/unit -q` touched-surface subset + `npm test` (vitest run) + `npx vite build` — **0 net-new tsc errors** vs the captured ~30-error SEED-056/049 baseline.
- **Before `/gsd:verify-work`:** Full suites green + the SC#10 4-axis live UAT below.
- **Max feedback latency:** ~30 seconds (touched-surface quick suite)

---

## Per-Task Verification Map

> Scaffolded from the requirement→test map below. Bind each row to a real
> `153-NN-MM` task ID once PLAN.md files exist (execute-phase / verify-work updates Status).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 153-01 T1 (backend strip) | 153-01 | 1 | CITE-01 | integrity (D-02) | Non-member `[n]` stripped before persist | unit | `pytest tests/unit/test_153_citation_markers.py::test_strips_non_members -x` | ❌ W0 | ⬜ pending |
| 153-01 T1 (backend renumber) | 153-01 | 1 | CITE-01 | integrity (D-03) | Survivors renumber 1..k to footer order | unit | `pytest tests/unit/test_153_citation_markers.py::test_renumbers_to_footer -x` | ❌ W0 | ⬜ pending |
| 153-01 T1 (code-span skip) | 153-01 | 1 | CITE-01 | Pitfall 2 | `[n]` in code span/block NOT a marker | unit | `pytest tests/unit/test_153_citation_markers.py::test_skips_code_spans -x` | ❌ W0 | ⬜ pending |
| 153-01 T3 (no-inject off-retrieval) | 153-01 | 1 | CITE-01 | D-12/D-14 | Non-retrieval turn → prompt byte-identical | unit | `pytest tests/unit/test_153_citation_instruction.py::test_no_inject_without_retrieval -x` | ❌ W0 | ⬜ pending |
| 153-01 T3 (dual-channel inject) | 153-01 | 1 | CITE-01 | SC#10 | Injection reaches BOTH `active_system_prompt` and `messages[0]` | unit | `pytest tests/unit/test_153_citation_instruction.py::test_dual_channel_inject -x` | ❌ W0 | ⬜ pending |
| 153-05 T1 (CitedMarkdown render) | 153-05 | 3 | CITE-01 | XSS (V5) | `[n]` → interactive `<sup>` keyed to `citations[n-1]`; range-checked | unit | `npx vitest run …/CitedMarkdown.test.tsx` | ❌ W0 | ⬜ pending |
| 153-03 T2 (footer numbering) | 153-03 | 2 | CITE-01 | — | Footer numbered, open-by-default w/ markers; marker↔row flash | unit | `npx vitest run …/CitationList.test.tsx` | ❌ W0 | ⬜ pending |
| 153-04 T1 (full-doc peek) | 153-04 | 2 | CITE-01 | D-10 | "Full document" + Open, no snippet/score | unit | `npx vitest run …/CitationPeek.test.tsx` | ❌ W0 | ⬜ pending |
| 153-05 T2 (G-5 non-regression msg) | 153-05 | 3 | CITE-01 | G-5 | Non-cited assistant + user messages byte-identical | unit | `npx vitest run …/MessageItem.test.tsx` | ✅ extend | ⬜ pending |
| 153-05 T2 (G-5 non-regression stream) | 153-05 | 3 | CITE-01 | G-5 | Streaming-narration / `dedupParagraphs` unchanged | unit | `npx vitest run …/StreamsProvider*.test.tsx` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_153_citation_markers.py` — strip / renumber / code-span (pure helper)
- [ ] `backend/tests/unit/test_153_citation_instruction.py` — retrieval-gated dual-channel injection; byte-identical off-retrieval
- [ ] `frontend/src/components/chat/__tests__/CitedMarkdown.test.tsx` — marker parse / render / range-check
- [ ] `frontend/src/components/chat/__tests__/CitationPeek.test.tsx` — chunk + full-doc peek variants, pin, Esc, a11y name
- [ ] `frontend/src/components/chat/__tests__/CitationList.test.tsx` — numbering + open-by-default + marker↔row flash (or extend existing `CitationCard.test.tsx`)
- [ ] Extend `MessageItem.test.tsx` + streaming provider tests for the G-5 non-regression assertions

---

## Manual-Only Verifications

> Per CLAUDE.md UAT recipe (SC#10 4-axis) — authored HERE, not as PLAN.md tasks.
> Chrome MCP (live UI) drives cross-provider; psycopg2 :54322 corroborates set-membership.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **Cross-provider markers + graceful degradation** | CITE-01 / SC#10 | Model-emission variance is only observable on a live model per provider | One representative model each for OpenAI, Anthropic, Google, OpenRouter — confirm markers render on native providers and degrade to **footer-only** where the model emits none (D-06/D-07). OpenRouter axis may be blocked by external BUG-260714-02 (operator-accept precedent). |
| **Multi-tool (chunk + full-doc)** | CITE-01 / D-09/D-10 | Real retrieval mix needed | One prompt exercising `search_documents` + `fetch_document_file`/full-doc in one answer — both chunk and full-doc citations produce markers/rows; full-doc peek shows "Full document" + Open (no snippet/score). |
| **Parallel-thread isolation** | CITE-01 / SC#10 | Concurrent streams can't be unit-tested end-to-end | Thread A streaming (calm, unmarked) while Thread B accepts a new prompt — markers attach on A's settle without bleeding into B. |
| **Long-message settle reconcile** | CITE-01 / SC#10 | Needs ≥50 prior msgs or ≥5KB prompt live | Confirm the settle reconcile still swaps live→normalized content; no marker flash/drift. |
| **General-knowledge non-regression** | CITE-01 / D-14 | Byte-identical claim needs the real render path | A no-retrieval turn renders nothing extra (no footer, no markers, no ⓘ banner) — byte-identical to today. |
| **Set-membership integrity (DB corroboration)** | CITE-01 / D-01/D-02 | Persisted `content` must carry only validated `[n]` | Via psycopg2 :54322: assert the persisted message `content` contains no `[n]` whose index exceeds the run's `source_refs`/`citations` count. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
