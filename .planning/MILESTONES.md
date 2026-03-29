# Milestones

## v1.0 Knowledge Base Explorer (Shipped: 2026-03-29)

**Phases completed:** 8 phases, 18 plans, 22 tasks

**Key accomplishments:**

- Postgres adjacency-list folders table with RLS, cascade delete, and 5 FastAPI CRUD endpoints (create/list/children/rename/delete) with ownership enforcement
- Document-folder integration: `folder_id` FK, `full_markdown` storage, and move endpoints for files and folders
- Ingestion UI two-panel layout with folder tree, CRUD controls, and folder-targeted uploads (51 integration tests)
- `ls` and `tree` KB navigation tools with in-memory path resolution, depth limits, and truncation indicators
- `grep` (regex content search) and `glob` (filename pattern matching with `**` support) search tools
- `read` tool for full document or line-range retrieval from stored markdown
- Explorer sub-agent: backend mode branching on `agent_mode` with 6 KB-only tools and dedicated system prompt
- General/Explorer mode selector dropdown in chat toolbar (Compass icon, agentMode state in ChatArea)
- Global folder sharing via updated RLS (migration 015); folder-scoped chat threads with recursive subtree RAG scoping (migration 016)
- FolderDetail info bar: doc count, total size, global badge, subfolder count, creation date

## Post-v1.0 Enhancements (2026-03-29)

**Aether Intelligence Design System** (visual-only, no functionality changes):

- Complete CSS variable system with dark + light mode (`--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--border`, `--success`, `--sidebar`, etc.)
- Theme toggle (Sun/Moon) in Sidebar; `useTheme` hook persists to localStorage, respects `prefers-color-scheme`; FOUC prevention script in `index.html`
- Google Fonts (Inter + Manrope), custom Tailwind font families (`sans`, `headline`, `mono`), keyframe animations (`fadeSlideUp`, `pulseGlow`)
- Glassmorphism chat input, gradient user bubbles, animated thinking dots, color-coded tool call icons, gradient send button
- AuthPage gradient orbs + glassmorphism card; IngestionPage/SettingsPage ghost-border cards

**Backend bug fix:**

- `folders.py` null-guard: `maybe_single().execute()` can return `None` when no row exists; added `if name_check and name_check.data` guard in both create and rename endpoints to prevent `AttributeError` on `None.data`

---
