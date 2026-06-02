"""Phase 093 D-20 — opt-in, secret-redacting backend file log-sink.

Today the backend logs to the uvicorn console only (``main.py`` configures just
``getLogger`` + an asyncio-noise suppressor — no file handler). During a live
cross-provider re-UAT the agent cannot see the operator's terminal, so it cannot
self-scan for the diagnostic signals it needs (``gpt-4o`` sub-agent fallback,
``runs.usage missing``, the ``400 thought_signature/reasoning_content missing``
round-trip errors).

``install_file_log_sink()`` MIRRORS the app's existing ``logging`` calls to a
**gitignored** file when ``LOG_FILE_PATH`` (or ``BACKEND_LOG_FILE``) is set. It is
strictly opt-in — with the env var unset it installs NO handler and logging stays
byte-identical console-only.

Security (T-093-06-*):
  * The sink only mirrors existing ``logging`` calls — it adds NO new logging of
    request/response bodies (prompt + document content). PII never reaches the file.
  * A ``_RedactingFilter`` strips provider API keys (``sk-…``), ``Bearer`` /
    ``Authorization`` values, JWT-shaped tokens, and the live VALUES of all
    provider key env vars BEFORE any record is written — defense-in-depth for
    whatever the app already logs (error strings + structured warnings).
  * The default logfile path lives under ``logs/`` / ``.log`` so the existing
    ``.gitignore`` rules (``logs/`` + ``*.log``) keep a secret-bearing log out of
    version control — the load-bearing leak mitigation.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# The backend dir (parent of app/) — relative LOG_FILE_PATH values resolve here so
# the default ``logs/backend.log`` lands at backend/logs/backend.log (gitignored).
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

# Provider secret env var names — the leak surface config.py loads. Their live
# VALUES are redacted when present (length >= 8 guard avoids redacting empty /
# trivially-short values).
_SECRET_ENV_VARS: tuple[str, ...] = (
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "DEEPSEEK_API_KEY",
    "MOONSHOT_API_KEY",
    "ZHIPU_API_KEY",
    "GLM_API_KEY",
    "MINIMAX_API_KEY",
    "OPENROUTER_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TAVILY_API_KEY",
)

# Compiled ONCE at module load. (pattern, replacement) applied in order to the
# FORMATTED message. Order matters: redact the structural shapes first, then the
# literal env values.
_REDACTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # OpenAI-style keys (sk-...) — must run before the env-value pass so the
    # marker is stable even if the key isn't a currently-set env var.
    (re.compile(r"sk-[A-Za-z0-9_\-]{6,}"), "sk-***REDACTED***"),
    # Authorization: Bearer <token> / bearer=<token> — keep the keyword, redact value.
    (
        re.compile(r"(?i)\b(authorization|bearer)\b\s*[:=]?\s*([A-Za-z0-9._\-]{8,})"),
        r"\1: ***REDACTED***",
    ),
    # JWT-shaped tokens (eyJ...).
    (re.compile(r"eyJ[A-Za-z0-9._\-]{10,}"), "***REDACTED-JWT***"),
]


class _RedactingFilter(logging.Filter):
    """Rewrite each record so the FORMATTED message has secrets removed.

    Interpolates ``%``-args first (``record.getMessage()``), runs the static
    pattern chain, then redacts the live VALUES of the provider key env vars, then
    sets ``record.msg`` to the redacted string and ``record.args = ()``. Always
    returns True — it redacts, never drops.
    """

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003 - logging API
        try:
            message = record.getMessage()
        except Exception:
            # If interpolation itself fails, leave the record untouched rather
            # than risk dropping a diagnostic line.
            return True

        for pattern, replacement in _REDACTION_PATTERNS:
            message = pattern.sub(replacement, message)

        # Redact the live values of provider key env vars (most specific last so a
        # raw key value that slipped past the shape patterns is still caught).
        for name in _SECRET_ENV_VARS:
            value = os.environ.get(name)
            if value and len(value) >= 8:
                message = message.replace(value, "***REDACTED-KEY***")

        record.msg = message
        record.args = ()
        return True


def install_file_log_sink() -> str | None:
    """Install a redacting RotatingFileHandler on the root logger when configured.

    Opt-in: with neither ``LOG_FILE_PATH`` nor ``BACKEND_LOG_FILE`` set, installs
    NO handler and returns ``None`` (byte-identical pre-093-06 console-only logging).

    Idempotent: a second call does NOT add a second sink handler.

    Returns the resolved logfile path when a handler is active (incl. the
    already-installed case), else ``None``.
    """
    raw_path = os.getenv("LOG_FILE_PATH") or os.getenv("BACKEND_LOG_FILE")
    if not raw_path:
        return None  # opt-in — no env var, no handler.

    path = Path(raw_path)
    if not path.is_absolute():
        path = _BACKEND_DIR / path
    resolved = str(path)

    root = logging.getLogger()

    # Idempotency guard — never attach a second sink.
    for existing in root.handlers:
        if getattr(existing, "_gsd_093_sink", False):
            return resolved

    os.makedirs(path.parent, exist_ok=True)

    handler = logging.handlers.RotatingFileHandler(
        resolved,
        maxBytes=10_000_000,
        backupCount=3,
        encoding="utf-8",
    )
    handler._gsd_093_sink = True  # type: ignore[attr-defined]
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    handler.addFilter(_RedactingFilter())
    root.addHandler(handler)

    # Ensure app ``logger.info`` lines reach the file: lower the root level to INFO
    # only if it is currently HIGHER (never raise a deliberately-lower level, and
    # never touch the asyncio logger — main.py keeps it at ERROR). level==0 (NOTSET)
    # means "defer to handlers" so we set INFO there too.
    current = root.level
    if current == logging.NOTSET or current > logging.INFO:
        root.setLevel(logging.INFO)

    # Best-effort restrictive permissions (Windows may ignore the POSIX bits — the
    # gitignore is the real protection; T-093-06-PERMS accepted).
    try:
        os.chmod(resolved, 0o600)
    except OSError:
        pass

    return resolved
