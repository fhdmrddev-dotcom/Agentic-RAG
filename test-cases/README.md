# UI Test Cases — Agentic RAG

Manual test scenarios for validating the full application end-to-end and demonstrating its capabilities.

## Structure

| File | Coverage |
|------|----------|
| [01-auth.md](./01-auth.md) | Sign up, sign in, sign out, session persistence |
| [02-thread-management.md](./02-thread-management.md) | Create, rename, delete threads; auto-naming |
| [03-document-ingestion.md](./03-document-ingestion.md) | Upload, dedup, multi-file, multi-format |
| [04-folder-system.md](./04-folder-system.md) | Create folders, nest, move documents, filter |
| [05-general-chat.md](./05-general-chat.md) | RAG retrieval, tool calls, streaming, model selector |
| [06-explorer-mode.md](./06-explorer-mode.md) | All KB tools — ls, tree, grep, glob, read, analyze |
| [07-power-scenarios.md](./07-power-scenarios.md) | Multi-tool chains, sub-agents, complex queries |
| [08-settings.md](./08-settings.md) | Settings dashboard inspection |
| [09-edge-cases.md](./09-edge-cases.md) | Empty states, errors, duplicates, large files |

## Legend

- **GIVEN** — precondition
- **WHEN** — action performed
- **THEN** — expected result
- ✅ Pass / ❌ Fail / ⏭ Skip

## Environment

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Supabase Studio: `http://127.0.0.1:54323`
