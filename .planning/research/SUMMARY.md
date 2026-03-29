# Research Summary: v2.0 Agent Skills & Code Execution

**Synthesized:** 2026-03-29
**Source:** ARCHITECTURE.md (full source code inspection) + PRD analysis
**Note:** STACK, FEATURES, and PITFALLS research agents hit API rate limits. Key findings synthesized manually from PRD + ARCHITECTURE.md direct source inspection.

---

## Key Findings

### Stack Additions

| Package | Purpose | Install |
|---------|---------|---------|
| `llm-sandbox` | Docker-based Python sandbox, IPython kernel persistence | `pip install llm-sandbox` |
| `python-multipart` | Already installed for document upload — reused for ZIP import | — |
| `pyyaml` | SKILL.md frontmatter parsing | `pip install pyyaml` |
| `zipfile` (stdlib) | ZIP generation/parsing | stdlib |
| `docker` SDK | Indirect via llm-sandbox — must have Docker running | via llm-sandbox |

No new frontend dependencies needed — existing SSE client + shadcn handles the new event types and UI.

### Architecture Decisions (from ARCHITECTURE.md)

1. **Build order:** Persistent Tool Memory → Skills Core → Skills LLM → Skills UI → Open Standard → Sandbox backend → Sandbox UI
2. **Skill catalog:** Inject only name + description per turn (~100 tokens for 10 skills). Full instructions loaded on demand via `load_skill`.
3. **Sandbox sessions:** One Docker container per `thread_id`, TTL 30 min, reused across `execute_code` calls in the same thread.
4. **Async Docker:** `execute_code` dispatch must use `await` / `asyncio.run_in_executor` — blocking Docker calls inside the SSE async generator will freeze the event loop.
5. **No schema changes for tool memory:** `tool_calls` JSONB column already exists — just add `tool_call_id` to the dict and reconstruct on load.
6. **Explorer Mode isolation:** `get_explorer_tools()` is static and must never receive skill or sandbox tools.

### Critical Pitfalls (from architecture analysis)

1. **Token bloat** — Injecting full skill instructions into every system prompt. Prevention: catalog-only injection, load on demand.
2. **Sync Docker calls** — Blocking the FastAPI event loop. Prevention: always `await` sandbox operations.
3. **No session cleanup** — Docker containers leaking on thread delete. Prevention: lifespan handler + thread delete hook.
4. **ZIP path traversal** — Malicious filenames like `../../etc/passwd` in imported ZIPs. Prevention: sanitize all filenames with `os.path.basename()` before extraction.
5. **Tool result bloat** — Storing unbounded tool results in JSONB. Prevention: existing 2000-char cap preserved.
6. **Explorer Mode contamination** — Accidentally adding new tools to `get_explorer_tools()`. Prevention: only modify `get_tools()`.

### Feature Scope Confirmed

All 5 PRD features are in scope for v2.0 as specified. No features were descoped during research. The architecture is clean:
- 4 modified existing files
- 4 new backend files
- 4 new DB tables
- 2 new Storage buckets
- 1 new frontend tab + 1 new output panel

---

## Research Gaps

- **STACK.md** — not written (rate limit). Stack is simple: `llm-sandbox`, `pyyaml`, stdlib `zipfile`. No research ambiguity.
- **FEATURES.md** — not written (rate limit). PRD is authoritative. No external feature research needed.
- **PITFALLS.md** — not written (rate limit). Key pitfalls captured above from architecture analysis.

These gaps do not block requirements or roadmap definition. The PRD is complete and ARCHITECTURE.md provides authoritative integration analysis from direct source inspection.

---
*Synthesized: 2026-03-29 for v2.0 milestone*
