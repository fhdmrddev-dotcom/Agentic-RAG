"""Sandbox session manager — owns Docker sandbox sessions keyed by thread_id.

IMPORTANT: llm_sandbox is imported lazily inside get_or_create() so that
when SANDBOX_ENABLED=false the Docker SDK is never loaded.
"""
from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)

_sessions: dict[str, object] = {}
_last_used: dict[str, float] = {}


class SandboxSessionManager:
    """Manages InteractiveSandboxSession instances keyed by thread_id."""

    def get_or_create(self, thread_id: str) -> object:
        """Return existing session or create a new one for this thread."""
        from llm_sandbox import InteractiveSandboxSession  # lazy import

        # Evict expired sessions (lazy TTL check)
        self._evict_expired()

        if thread_id not in _sessions:
            session = InteractiveSandboxSession(lang="python", verbose=False)
            session.open()
            _sessions[thread_id] = session
            logger.info("Sandbox session opened for thread %s", thread_id)
        _last_used[thread_id] = time.time()
        return _sessions[thread_id]

    def close_session(self, thread_id: str) -> None:
        """Close and remove session for thread_id. No-op if not found."""
        session = _sessions.pop(thread_id, None)
        _last_used.pop(thread_id, None)
        if session:
            try:
                session.close()
                logger.info("Sandbox session closed for thread %s", thread_id)
            except Exception as e:
                logger.warning("Error closing sandbox session %s: %s", thread_id, e)

    def close_all(self) -> None:
        """Close all open sessions. Called during app shutdown."""
        for thread_id in list(_sessions.keys()):
            self.close_session(thread_id)

    def _evict_expired(self) -> None:
        """Lazy TTL eviction — close sessions idle longer than sandbox_ttl_minutes."""
        from app.config import settings
        ttl_seconds = settings.sandbox_ttl_minutes * 60
        now = time.time()
        for tid in list(_last_used.keys()):
            if now - _last_used[tid] > ttl_seconds:
                logger.info("Evicting expired sandbox session %s", tid)
                self.close_session(tid)


sandbox_manager = SandboxSessionManager()
