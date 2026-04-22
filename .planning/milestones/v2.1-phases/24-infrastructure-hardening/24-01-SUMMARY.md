---
phase: 24-infrastructure-hardening
plan: 01
status: complete
completed: 2026-04-10
---

## What was built

Two infrastructure improvements:

1. **Settings file TTL cache** — `_load_override()` in `backend/app/models/user_settings.py` now caches the result with a 5-second TTL using a module-level `(data, timestamp)` tuple. Reduces per-message disk reads during active conversations. After 5 seconds the cache expires and the next call re-reads from disk.

2. **Sentence boundary chunking fix** — `chunk_text()` in `backend/app/services/embedding_service.py` now only splits on punctuation (`.!?`) when followed by whitespace or end-of-string. Prevents incorrect splits on abbreviations (`Dr.`, `U.S.A.`) and decimal numbers (`3.14`).

## Key files
- `backend/app/models/user_settings.py` — TTL cache on _load_override
- `backend/app/services/embedding_service.py` — punctuation + whitespace split guard
- `backend/tests/unit/test_infrastructure.py` — unit tests for both

## Verification
- Committed in d996f9f
