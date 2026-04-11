# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1–8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9–17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18–25 (shipped 2026-04-11)

## Phases

<details>
<summary>✅ v1.0 Knowledge Base Explorer (Phases 1–8) — SHIPPED 2026-03-29</summary>

- [x] Phase 1: Folder Schema & Core APIs (2/2 plans) — completed 2026-03-21
- [x] Phase 2: Document-Folder Integration (2/2 plans) — completed 2026-03-21
- [x] Phase 3: Ingestion UI (3/3 plans) — completed 2026-03-21
- [x] Phase 4: Navigation Tools (2/2 plans) — completed 2026-03-22
- [x] Phase 5: Search Tools (2/2 plans) — completed 2026-03-21
- [x] Phase 6: Read Tool (2/2 plans) — completed 2026-03-22
- [x] Phase 7: Explorer Sub-Agent (2/2 plans) — completed 2026-03-22
- [x] Phase 8: Folder System Enhancements (3/3 plans) — completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Agent Skills & Code Execution (Phases 9–17) — SHIPPED 2026-04-04</summary>

- [x] Phase 9: Persistent Tool Memory — store tool_call_id + reconstruct multi-turn history (completed 2026-03-29)
- [x] Phase 10: Agent Skills Core — DB schema, RLS, FastAPI router, Supabase Storage bucket (completed 2026-03-31)
- [x] Phase 11: Skills LLM Integration — catalog injection, load_skill / save_skill / read_skill_file tools + dispatch (completed 2026-04-01)
- [x] Phase 12: Skills UI — Skills tab (CRUD, toggle, share), skill-creator seed skill (completed 2026-04-02)
- [x] Phase 13: Skills Open Standard — ZIP import/export (agentskills.io format) (completed 2026-04-02)
- [x] Phase 14: Code Execution Sandbox — Docker session manager, execute_code tool, SSE streaming, DB tables (completed 2026-04-03)
- [x] Phase 15: Code Output UI — streaming output panel, file download links (completed 2026-04-03)
- [x] Phase 16: Skill File Management UI — upload/list/delete files on skills (closes FILE-01, FILE-02) (completed 2026-04-04)
- [x] Phase 17: Tech Debt Cleanup — fix system prompt tool count, stale checkboxes, Phase 15 verification (completed 2026-04-04)

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Stability & RAG Correctness (Phases 18–25) — SHIPPED 2026-04-11</summary>

- [x] Phase 18: Context Window Hardening (1/1 plans) — completed 2026-04-09
- [x] Phase 19: Sub-Agent Guards & API Error Visibility (1/1 plans) — completed 2026-04-10
- [x] Phase 20: Blank Response Guards (1/1 plans) — completed 2026-04-10
- [x] Phase 21: Keyword Search Folder Scope (1/1 plans) — completed 2026-04-10
- [x] Phase 22: RAG Correctness Fixes (1/1 plans) — completed 2026-04-10
- [x] Phase 23: System Prompt Quality (1/1 plans) — completed 2026-04-10
- [x] Phase 24: Infrastructure Hardening (1/1 plans) — completed 2026-04-10
- [x] Phase 25: Sub-Agent Intelligence & Model-Aware Context (1/1 plans) — completed 2026-04-10

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Folder Schema & Core APIs | v1.0 | 2/2 | Complete | 2026-03-21 |
| 2. Document-Folder Integration | v1.0 | 2/2 | Complete | 2026-03-21 |
| 3. Ingestion UI | v1.0 | 3/3 | Complete | 2026-03-21 |
| 4. Navigation Tools | v1.0 | 2/2 | Complete | 2026-03-22 |
| 5. Search Tools | v1.0 | 2/2 | Complete | 2026-03-21 |
| 6. Read Tool | v1.0 | 2/2 | Complete | 2026-03-22 |
| 7. Explorer Sub-Agent | v1.0 | 2/2 | Complete | 2026-03-22 |
| 8. Folder System Enhancements | v1.0 | 3/3 | Complete | 2026-03-28 |
| 9. Persistent Tool Memory | v2.0 | 1/1 | Complete | 2026-03-29 |
| 10. Agent Skills Core | v2.0 | 3/3 | Complete | 2026-03-31 |
| 11. Skills LLM Integration | v2.0 | 3/3 | Complete | 2026-04-01 |
| 12. Skills UI | v2.0 | 3/3 | Complete | 2026-04-02 |
| 13. Skills Open Standard | v2.0 | 2/2 | Complete | 2026-04-02 |
| 14. Code Execution Sandbox | v2.0 | 5/5 | Complete | 2026-04-03 |
| 15. Code Output UI | v2.0 | 2/2 | Complete | 2026-04-03 |
| 16. Skill File Management UI | v2.0 | 2/2 | Complete | 2026-04-04 |
| 17. Tech Debt Cleanup | v2.0 | 1/1 | Complete | 2026-04-04 |
| 18. Context Window Hardening | v2.1 | 1/1 | Complete | 2026-04-09 |
| 19. Sub-Agent Guards & API Error Visibility | v2.1 | 1/1 | Complete | 2026-04-10 |
| 20. Blank Response Guards | v2.1 | 1/1 | Complete | 2026-04-10 |
| 21. Keyword Search Folder Scope | v2.1 | 1/1 | Complete | 2026-04-10 |
| 22. RAG Correctness Fixes | v2.1 | 1/1 | Complete | 2026-04-10 |
| 23. System Prompt Quality | v2.1 | 1/1 | Complete | 2026-04-10 |
| 24. Infrastructure Hardening | v2.1 | 1/1 | Complete | 2026-04-10 |
| 25. Sub-Agent Intelligence & Model-Aware Context | v2.1 | 1/1 | Complete | 2026-04-10 |
