"""Project-scoped launcher for the LangSmith MCP server.

Purpose
-------
- Loads `backend/.env` so LANGSMITH_API_KEY (and optional LANGSMITH_PROJECT,
  LANGSMITH_ENDPOINT) are present in this process's environment.
- Exec's `langsmith-mcp-server` (must be installed in `backend/venv`).
- Inherits stdio transparently so MCP JSON-RPC over stdin/stdout works.

Why a wrapper
-------------
The Antigravity MCP runner spawns the configured `command` with `args` and
inherits its OWN environment (the IDE's process env). It does NOT auto-load
project `.env` files. Without this wrapper, the only ways to give the MCP
server its API key are:

  1. Inline the key in `.mcp.json` (plaintext-in-git, the security issue
     we just fixed for Supabase — never do this again).
  2. Put the key in Windows User-level env vars (works but is global —
     pollutes every MCP across every project).

This wrapper makes the secret strictly project-local: the key lives only in
`backend/.env` (gitignored), and only this script reads it.

Setup (one-time, per workstation)
---------------------------------
1. Make sure LANGSMITH_API_KEY is set in `backend/.env` (you already have it).
2. Install the MCP server into the project venv:
     backend/venv/Scripts/pip install langsmith-mcp-server
3. Restart Antigravity (so the new `.mcp.json` is picked up).
4. In the next Claude session, ask Claude to ToolSearch for `langsmith` —
   tools should appear in the deferred list and be loadable.

If the MCP server fails to start
---------------------------------
The launcher prints diagnostic errors to stderr which the Antigravity MCP
runner captures. Common failure modes:
- `langsmith-mcp-server` not installed in the venv → see setup step 2 above.
- LANGSMITH_API_KEY missing → check `backend/.env`.
- The package name `langsmith-mcp-server` changed upstream → override via
  env var `LANGSMITH_MCP_CMD` to point at the correct CLI command.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

# --- Step 1: locate and load backend/.env -----------------------------------

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / "backend" / ".env"

if not ENV_PATH.is_file():
    print(f"ERROR: backend/.env not found at {ENV_PATH}", file=sys.stderr)
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print(
        "ERROR: python-dotenv not installed in backend/venv. "
        "Install with: backend/venv/Scripts/pip install python-dotenv",
        file=sys.stderr,
    )
    sys.exit(1)

load_dotenv(ENV_PATH)

# --- Step 2: validate required env vars -------------------------------------

if not os.environ.get("LANGSMITH_API_KEY") and not os.environ.get("LANGCHAIN_API_KEY"):
    print(
        f"ERROR: Neither LANGSMITH_API_KEY nor LANGCHAIN_API_KEY found in {ENV_PATH}. "
        "Add one before running the LangSmith MCP server.",
        file=sys.stderr,
    )
    sys.exit(1)

# Normalize to the LANGSMITH_* names the new SDK expects.
if not os.environ.get("LANGSMITH_API_KEY") and os.environ.get("LANGCHAIN_API_KEY"):
    os.environ["LANGSMITH_API_KEY"] = os.environ["LANGCHAIN_API_KEY"]
if not os.environ.get("LANGSMITH_PROJECT") and os.environ.get("LANGCHAIN_PROJECT"):
    os.environ["LANGSMITH_PROJECT"] = os.environ["LANGCHAIN_PROJECT"]
if not os.environ.get("LANGSMITH_ENDPOINT") and os.environ.get("LANGCHAIN_ENDPOINT"):
    os.environ["LANGSMITH_ENDPOINT"] = os.environ["LANGCHAIN_ENDPOINT"]

# --- Step 3: locate the MCP server CLI in the venv --------------------------

# Allow override for the (likely) day when upstream renames or repackages.
mcp_cmd_name = os.environ.get("LANGSMITH_MCP_CMD", "langsmith-mcp-server")

scripts_dir = ROOT / "backend" / "venv" / "Scripts"  # Windows venv layout
mcp_exe = scripts_dir / f"{mcp_cmd_name}.exe"
if not mcp_exe.is_file():
    # POSIX fallback (linux/macOS venvs don't have .exe; CI / cross-platform safe)
    posix_exe = ROOT / "backend" / "venv" / "bin" / mcp_cmd_name
    if posix_exe.is_file():
        mcp_exe = posix_exe
    else:
        print(
            f"ERROR: {mcp_cmd_name} not found in {scripts_dir} (or POSIX equivalent). "
            f"Install with: backend/venv/Scripts/pip install langsmith-mcp-server",
            file=sys.stderr,
        )
        sys.exit(1)

# --- Step 4: spawn the MCP server with full stdio inheritance ---------------

# subprocess.run with inherited file descriptors gives MCP its JSON-RPC pipe
# unmodified. Do NOT pipe through Python text-mode IO — would buffer/break
# binary chunks. Return its exit code.
try:
    result = subprocess.run(
        [str(mcp_exe)],
        env=os.environ.copy(),
        stdin=sys.stdin,
        stdout=sys.stdout,
        stderr=sys.stderr,
        check=False,
    )
except KeyboardInterrupt:
    sys.exit(130)
except Exception as e:
    print(f"ERROR: failed to spawn {mcp_exe}: {type(e).__name__}: {e}", file=sys.stderr)
    sys.exit(1)

sys.exit(result.returncode)
