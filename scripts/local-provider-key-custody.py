"""Save / restore ONE stored provider key in the LOCAL database (Phase 294-01 Task 4, N5, T-294-34).

Exists only for the OPTIONAL real-key swap in the live forced-failure drive (VALIDATION F1 / F2
extra): save the stored key, put a bad one in through the Settings UI, drive the 401, then restore
the original exactly. The default forced-failure path needs none of this — it uses
``scripts/decision-fault-server.py`` and a dummy token.

    backend/venv/Scripts/python scripts/local-provider-key-custody.py save    --column openrouter_api_key --to   <file>
    backend/venv/Scripts/python scripts/local-provider-key-custody.py restore --column openrouter_api_key --from <file>

⛔ The DSN is HARD-CODED to the local Supabase (127.0.0.1:54322) and no environment variable is
   read — it cannot reach cloud even by accident (the apply-script rule).
⛔ Only ``openrouter_api_key`` and ``openai_api_key`` can be touched; anything else exits 2. The
   column name comes from that allowlist only, and every value is bound as ``$N``.
⛔ The value is never printed. It is written to / read from the given file, which must be OUTSIDE
   this repository (use the session scratchpad). A value that is not an ``enc:v1:`` envelope gets a
   warning (it may be plaintext or empty), never an echo.
⛔ Run under the local-DB lock (``C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock``).
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
ALLOWED_COLUMNS = ("openrouter_api_key", "openai_api_key")
SETTINGS_ROW_ID = "global"
ENVELOPE_PREFIX = "enc:v1:"   # app/security/secret_cipher.py _ENVELOPE_PREFIX
REPO_ROOT = Path(__file__).resolve().parent.parent

_SELECT = {c: f"SELECT {c} FROM public.app_settings WHERE id = $1" for c in ALLOWED_COLUMNS}
_UPDATE = {c: f"UPDATE public.app_settings SET {c} = $1 WHERE id = $2" for c in ALLOWED_COLUMNS}


async def _connect():
    import asyncpg

    return await asyncpg.connect(DSN)


def _refuse_repo_path(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if resolved == REPO_ROOT or REPO_ROOT in resolved.parents:
        sys.stderr.write("REFUSED: the key file must live OUTSIDE the repository (use the scratchpad)\n")
        raise SystemExit(2)
    return resolved


def _warn_if_not_envelope(value: str | None) -> None:
    if not value or not value.startswith(ENVELOPE_PREFIX):
        sys.stderr.write(f"WARNING: the stored value is not an {ENVELOPE_PREFIX} envelope "
                         "(it may be plaintext or empty); it was handled but not printed\n")


async def _save(column: str, target: Path) -> int:
    conn = await _connect()
    try:
        value = await conn.fetchval(_SELECT[column], SETTINGS_ROW_ID)
    finally:
        await conn.close()
    _warn_if_not_envelope(value)
    target.write_text(value or "", encoding="utf-8")
    sys.stdout.write(f"saved {column} to {target} ({len(value or '')} chars)\n")
    return 0


async def _restore(column: str, source: Path) -> int:
    value = source.read_text(encoding="utf-8")
    _warn_if_not_envelope(value)
    conn = await _connect()
    try:
        await conn.execute(_UPDATE[column], value, SETTINGS_ROW_ID)
    finally:
        await conn.close()
    sys.stdout.write(f"restored {column} from {source} ({len(value)} chars)\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Save / restore one stored provider key (LOCAL DB only).")
    sub = parser.add_subparsers(dest="command", required=True)
    save = sub.add_parser("save")
    save.add_argument("--column", required=True, choices=ALLOWED_COLUMNS)
    save.add_argument("--to", required=True, type=Path)
    restore = sub.add_parser("restore")
    restore.add_argument("--column", required=True, choices=ALLOWED_COLUMNS)
    restore.add_argument("--from", dest="source", required=True, type=Path)
    args = parser.parse_args(argv)

    if args.command == "save":
        return asyncio.run(_save(args.column, _refuse_repo_path(args.to)))
    return asyncio.run(_restore(args.column, _refuse_repo_path(args.source)))


if __name__ == "__main__":
    raise SystemExit(main())
