"""Sandbox session manager — owns Docker sandbox sessions keyed by thread_id.

IMPORTANT: llm_sandbox is imported lazily inside get_or_create() so that
when SANDBOX_ENABLED=false the Docker SDK is never loaded.
"""
from __future__ import annotations

import hashlib  # Plan 075.4-03 D-075.4-D1 — SHA-256 content-hash dedup.
import logging
import os
import tempfile
import time

logger = logging.getLogger(__name__)

_sessions: dict[str, object] = {}
_last_used: dict[str, float] = {}


class SandboxSessionManager:
    """Manages InteractiveSandboxSession instances keyed by thread_id."""

    def get_or_create(self, thread_id: str) -> object:
        """Return existing session or create a new one for this thread.

        When the in-memory ``_sessions`` dict has no entry for ``thread_id``
        (e.g. after a worker bounce in multi-worker mode), the method checks
        Docker for an existing running container named ``sandbox-{thread_id[:12]}``
        and re-attaches to it (D-077-05). This preserves pip installs, generated
        files, and interpreter state across worker bounces. The external API is
        unchanged per D-077-06.
        """
        from llm_sandbox import InteractiveSandboxSession  # lazy import

        # Evict expired sessions (lazy TTL check)
        self._evict_expired()

        if thread_id not in _sessions:
            session_kwargs: dict = {"lang": "python", "verbose": False}
            custom_image = os.environ.get("SANDBOX_IMAGE")
            if custom_image:
                session_kwargs["image"] = custom_image
                logger.info(
                    "Sandbox session using custom image %s for thread %s",
                    custom_image, thread_id,
                )

            container_id = self._find_existing_container(thread_id)
            if container_id:
                session_kwargs["container_id"] = container_id
                logger.info(
                    "Re-attaching to existing container %s for thread %s",
                    container_id[:12], thread_id,
                )
            else:
                session_kwargs["runtime_configs"] = {
                    "name": f"sandbox-{thread_id[:12]}",
                    "labels": {"agentic_rag_thread_id": thread_id},
                }

            session = InteractiveSandboxSession(**session_kwargs)
            try:
                session.open()
            except Exception as e:
                if "409" in str(e) or "Conflict" in str(e):
                    logger.info(
                        "Container name conflict for thread %s -- re-looking up",
                        thread_id,
                    )
                    container_id = self._find_existing_container(thread_id)
                    if container_id:
                        session_kwargs["container_id"] = container_id
                        session_kwargs.pop("runtime_configs", None)
                        session = InteractiveSandboxSession(**session_kwargs)
                        session.open()
                    else:
                        raise
                else:
                    raise
            _sessions[thread_id] = session
            logger.info("Sandbox session opened for thread %s", thread_id)
        _last_used[thread_id] = time.time()
        return _sessions[thread_id]

    def _find_existing_container(self, thread_id: str) -> str | None:
        """Look up a running sandbox container by name convention (D-077-05).

        Container names follow the pattern ``sandbox-{thread_id[:12]}``.
        Returns the full container ID if found and running, None otherwise.
        Falls through to fresh creation on any Docker error (D-077-04).
        """
        try:
            import docker
            from docker.errors import NotFound
        except ImportError:
            logger.warning("Docker SDK not installed -- skipping container re-attach")
            return None

        try:
            client = docker.from_env()
            container = client.containers.get(f"sandbox-{thread_id[:12]}")
            if container.status == "running":
                logger.info(
                    "Found existing container %s for thread %s",
                    container.short_id, thread_id,
                )
                return container.id
            # Container exists but stopped -- D-077-05 says create fresh
            logger.info(
                "Container sandbox-%s exists but status=%s -- creating fresh",
                thread_id[:12], container.status,
            )
            return None
        except NotFound:
            return None
        except Exception as e:
            logger.warning(
                "Docker container lookup failed for thread %s: %s",
                thread_id, e,
            )
            return None

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


def harvest_output_files(
    session: object,
    execution_id: str,
    user_id: str,
    supabase,
    previous_files: dict[str, dict] | None = None,
    iteration: int = 0,
) -> tuple[list[dict], dict[str, dict]]:
    """Copy files from /sandbox/output/ in the container, upload to Supabase Storage,
    insert sandbox_files rows, and return delta + cumulative file metadata.

    Phase 075.4-03 Task 1 (D-075.4-D1/D2) — signature pivoted from set-of-
    filenames dedup to SHA-256 content-hash dedup. Structurally closes:
      - BUG-260523-03 (OpenRouter renders duplicate outputs across iterations)
      - BUG-260522-02 (final_output_files SSE payload had no url/size)
      - BUG-260521-02 (pinned panel no download link — auto-closes via above)

    Plan 04 (Wave 2) hook: when iteration N produces a DIFFERENT hash for
    the SAME filename, the delta entry carries ``supersedes: <prev_filename>``
    so OutputFileCard can render the "Replaces: <prev>" affordance.

    Phase 075.1 Plan 04 historical context (B-260519-11 + BUG-260514-01):
    the agent loop tracks per-iteration cumulative state so each cell's
    "Output files" panel renders ONLY files new/changed that cell;
    the cumulative final set drives the pinned "Final outputs" panel at
    the end of the loop (closes the "12 download links for 1 desired file"
    cognitive-load symptom).

    Args:
        previous_files: dict keyed by SHA-256 content hash → meta dict
            ({"filename", "url", "size", "iteration"}) accumulated across
            earlier iterations of the same run. None (default) = legacy mode
            — returns ALL current files as the delta (matches Phase 075
            cumulative-render behavior). The second tuple element is always
            populated so a caller can start tracking later.
        iteration: 0-indexed iteration counter; recorded in the meta dict
            for supersedes provenance (Plan 04 OutputFileCard can render
            "iteration 2 of 4").

    Returns:
        (delta_files, current_files_dict)
          - delta_files: list of {"filename", "url", "size"} for this cell's
            new/changed files (frontend renders these per-cell). Entries
            with a hash already in previous_files are SKIPPED. Entries with
            a NEW hash but a filename matching a previous entry get a
            ``supersedes: <prev_filename>`` key spread in.
          - current_files_dict: dict[content_hash, meta] for THIS iteration's
            files; the caller merges + passes back as previous_files on the
            next iteration to extend the per-run cumulative state.
    """
    output_files: list[dict] = []
    try:
        # Ensure /sandbox/output exists in the container before trying to copy
        # (os.makedirs inside the Python interpreter doesn't always persist to
        # the Docker filesystem layer that copy_from_runtime/get_archive reads)
        try:
            session.execute_command("mkdir -p /sandbox/output")
        except Exception:
            pass  # best-effort; copy_from_runtime will 404 if it truly doesn't exist

        with tempfile.TemporaryDirectory() as tmpdir:
            # Copy output directory from container to local temp dir.
            # No trailing slash — Docker's get_archive is strict about this.
            session.copy_from_runtime("/sandbox/output", tmpdir)

            # Walk the temp dir for files (copy_from_runtime may create subdirs)
            for root, _dirs, files in os.walk(tmpdir):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    file_size = os.path.getsize(fpath)

                    with open(fpath, "rb") as f:
                        data = f.read()

                    # Plan 075.4-03 D-075.4-D1 — SHA-256 content hash is the
                    # authoritative dedup key (PATTERNS.md §S5). Filename is
                    # an operator hint that can lie (model regenerates the
                    # same chart with a new name; operator renames between
                    # iterations). Hash is the byte-level truth.
                    content_hash = hashlib.sha256(data).hexdigest()

                    storage_path = f"{user_id}/{execution_id}/{fname}"

                    # Detect content-type by extension
                    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
                    content_type_map = {
                        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                        "gif": "image/gif", "svg": "image/svg+xml", "pdf": "application/pdf",
                        "csv": "text/csv", "txt": "text/plain", "json": "application/json",
                        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "zip": "application/zip",
                    }
                    content_type = content_type_map.get(ext, "application/octet-stream")

                    # Upload to sandbox-outputs bucket
                    supabase.storage.from_("sandbox-outputs").upload(
                        storage_path, data,
                        file_options={"content-type": content_type, "upsert": "true"},
                    )
                    logger.info("Uploaded sandbox file %s (%d bytes) to %s", fname, file_size, storage_path)

                    # Insert sandbox_files row
                    supabase.table("sandbox_files").insert({
                        "execution_id": execution_id,
                        "user_id": user_id,
                        "filename": fname,
                        "storage_path": storage_path,
                        "file_size": file_size,
                    }).execute()

                    # D-067.2-03: store the relative re-sign URL instead of the long-form 1h
                    # signed URL. Each click on this URL goes through GET /sandbox-outputs/{path}
                    # which authenticates the user, performs the ownership fence, and re-signs
                    # with a 60s TTL — keeps downloads alive indefinitely beyond the legacy
                    # 1h cap. Frontend (ExecuteCodeBlock.tsx) prepends VITE_API_BASE_URL when
                    # url.startsWith("/"); legacy http URLs (already-stored) pass through
                    # unchanged and decay after 1h as before (legacy decay accepted per
                    # CONTEXT.md § Claude's Discretion).
                    output_files.append({
                        "filename": fname,
                        "url": f"/sandbox-outputs/{storage_path}",
                        "size": file_size,
                        # internal field — stripped before SSE emit by caller
                        "content_hash": content_hash,
                    })
    except Exception as e:
        logger.error("Failed to harvest output files: %s", e, exc_info=True)

    # Plan 075.4-03 D-075.4-D1/D2 — content-hash dedup with supersedes
    # detection. previous_files=None = legacy mode (return all files as
    # delta + populated current dict so a caller can start tracking later).
    current_files_dict: dict[str, dict] = {}
    delta_files: list[dict] = []
    if previous_files is None:
        previous_files = {}
    # Index previous by filename so we can detect "same filename, different
    # hash" → supersedes case (PATTERNS.md S5 Plan 04 OutputFileCard hook).
    prev_by_filename = {meta["filename"]: meta for meta in previous_files.values()}

    for f in output_files:
        h = f["content_hash"]
        current_files_dict[h] = {
            "filename": f["filename"],
            "url": f["url"],
            "size": f["size"],
            "iteration": iteration,
        }
        if h in previous_files:
            continue  # same hash already seen — true duplicate, skip
        # New hash. Check for supersedes (same filename, different bytes).
        prev = prev_by_filename.get(f["filename"])
        delta_entry: dict = {
            "filename": f["filename"],
            "url": f["url"],
            "size": f["size"],
        }
        if prev:
            delta_entry["supersedes"] = prev["filename"]  # Plan 04 OutputFileCard reads this
        delta_files.append(delta_entry)
    return delta_files, current_files_dict
