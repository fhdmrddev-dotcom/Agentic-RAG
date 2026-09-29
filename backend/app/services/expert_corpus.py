"""Expert corpora — the sample knowledge an Expert ships with, as DATA in the repo (Phase 266 / D-266-05).

A corpus lives at ``backend/app/experts/corpora/<slug>/``: one ``manifest.json`` plus the files it
lists. Installing an Expert copies those bytes into the installing org through the ONE ingest path
(``mint_document_row`` → the normal extraction/embedding pipeline); nothing here chunks, embeds or
writes to the database.

⚠ A CORPUS IS DATA UNDER THE EXTENSION CONTRACT (``docs/EXTENSION-CONTRACT.md``). The directory is
  READ, never IMPORTED: there is no ``__init__.py`` and no ``.py`` under ``backend/app/experts``, and
  a test fails if one appears. This module reads bytes and parses one JSON manifest — nothing else.

⚠ WHY THE SOURCE IS THE REPO AND NOT A DATABASE ROW (D-266-05). Migration 188 seeded the report as a
  ``documents`` row in ONE org. Copying "from the seed row" would mean an install in org B reads a row
  belonging to org A — a cross-tenant read on the install path. The repo file is the same bytes with
  no tenant attached. ``test_266_corpus_verbatim.py`` proves the file equals 188's literal.

⚠ PATH CONTAINMENT (T-266-08). A slug is validated against ``SLUG_RE`` and every manifest filename
  against ``FILENAME_RE`` BEFORE any filesystem access, a filename containing ``..`` is refused, and
  every resolved path must stay inside ``CORPORA_ROOT`` (and, for a file, inside its slug directory),
  so a symlink or a crafted manifest cannot walk out of the directory.

⚠ OS-STABLE HASHING (Phase 266 Pitfall 5). This repo checks out with ``core.autocrlf=true``, so a
  Windows working copy of a text file is CRLF by default. Bytes are normalised CRLF → LF before they
  are hashed or returned, and ``.gitattributes`` pins ``eol=lf`` on the corpora besides — so
  ``corpus_version`` is the same on every machine that deploys it.

⚠ SYNCHRONOUS FILE I/O. Async callers must wrap ``load_corpus`` / ``has_corpus`` in
  ``run_in_threadpool`` (D-v2.5-01). No network, no DB.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from pydantic import BaseModel

CORPORA_ROOT: Path = (Path(__file__).resolve().parents[1] / "experts" / "corpora").resolve()

SLUG_RE = re.compile(r"^[a-z0-9-]+$")
FILENAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")

MANIFEST_NAME = "manifest.json"


class CorpusRefused(ValueError):
    """The slug or a manifest entry is malformed, or resolves outside the corpora root."""


class CorpusNotFound(LookupError):
    """A well-formed slug has no corpus directory, manifest, or listed file."""


class CorpusFile(BaseModel):
    filename: str
    mime_type: str
    raw: bytes
    sha256: str


class ExpertCorpus(BaseModel):
    slug: str
    folder_name: str
    files: list[CorpusFile]
    corpus_version: str


def normalise_bytes(raw: bytes) -> bytes:
    """CRLF → LF, nothing else. A lone CR is left untouched."""
    return raw.replace(b"\r\n", b"\n")


def _is_text_mime(mime_type: str) -> bool:
    mime = mime_type.strip().lower()
    return mime.startswith("text/") or mime == "application/json"


def _validate_slug(slug: object) -> str:
    # fullmatch, never match: `$` also matches before a trailing newline.
    if not isinstance(slug, str) or not SLUG_RE.fullmatch(slug):
        raise CorpusRefused(f"invalid corpus slug: {slug!r}")
    return slug


def _slug_dir(slug: str) -> Path:
    root = CORPORA_ROOT.resolve()
    slug_dir = (root / slug).resolve()
    if not slug_dir.is_relative_to(root) or slug_dir == root:
        raise CorpusRefused(f"corpus slug resolves outside the corpora root: {slug!r}")
    return slug_dir


def has_corpus(slug: str) -> bool:
    """True when ``slug`` names a corpus directory with a manifest. Never raises."""
    try:
        _validate_slug(slug)
        slug_dir = _slug_dir(slug)
        return slug_dir.is_dir() and (slug_dir / MANIFEST_NAME).is_file()
    except (CorpusRefused, OSError):
        return False


def _corpus_version(files: list[CorpusFile]) -> str:
    lines = sorted(f"{f.filename}\t{f.sha256}\n" for f in files)
    return hashlib.sha256("".join(lines).encode("utf-8")).hexdigest()


def load_corpus(slug: str) -> ExpertCorpus:
    """Load and hash one Expert's corpus.

    Raises ``CorpusRefused`` for a malformed slug or manifest entry (checked before any filesystem
    access for that name) and ``CorpusNotFound`` when a well-formed slug has nothing on disk.
    """
    _validate_slug(slug)
    slug_dir = _slug_dir(slug)
    manifest_path = (slug_dir / MANIFEST_NAME).resolve()
    if not manifest_path.is_relative_to(slug_dir):
        raise CorpusRefused(f"manifest resolves outside its corpus directory: {slug!r}")
    if not slug_dir.is_dir() or not manifest_path.is_file():
        raise CorpusNotFound(f"no corpus for slug {slug!r}")

    try:
        manifest = json.loads(normalise_bytes(manifest_path.read_bytes()).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CorpusRefused(f"unreadable manifest for {slug!r}: {exc}") from exc

    if not isinstance(manifest, dict):
        raise CorpusRefused(f"manifest for {slug!r} is not an object")
    folder_name = manifest.get("folder_name")
    entries = manifest.get("files")
    if not isinstance(folder_name, str) or not folder_name.strip():
        raise CorpusRefused(f"manifest for {slug!r} has no folder_name")
    if not isinstance(entries, list) or not entries:
        raise CorpusRefused(f"manifest for {slug!r} lists no files")

    files: list[CorpusFile] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise CorpusRefused(f"manifest entry for {slug!r} is not an object")
        filename = entry.get("filename")
        mime_type = entry.get("mime_type")
        if (
            not isinstance(filename, str)
            or not FILENAME_RE.fullmatch(filename)
            or ".." in filename
            or filename == MANIFEST_NAME
        ):
            raise CorpusRefused(f"invalid corpus filename for {slug!r}: {filename!r}")
        if not isinstance(mime_type, str) or not mime_type.strip():
            raise CorpusRefused(f"corpus file {filename!r} has no mime_type")
        # WR-07: normalise_bytes and .gitattributes both rewrite line endings, which would corrupt
        # a binary sample twice. Corpora are text until binary corpora are designed for.
        if not _is_text_mime(mime_type):
            raise CorpusRefused(f"corpus file {filename!r} is {mime_type!r}; corpora must be text")
        if filename in seen:
            raise CorpusRefused(f"corpus file {filename!r} is listed twice")
        seen.add(filename)

        file_path = (slug_dir / filename).resolve()
        if not file_path.is_relative_to(slug_dir) or file_path.parent != slug_dir:
            raise CorpusRefused(f"corpus file resolves outside its directory: {filename!r}")
        if not file_path.is_file():
            raise CorpusNotFound(f"corpus file {filename!r} listed but missing for {slug!r}")

        raw = normalise_bytes(file_path.read_bytes())
        files.append(
            CorpusFile(
                filename=filename,
                mime_type=mime_type,
                raw=raw,
                sha256=hashlib.sha256(raw).hexdigest(),
            )
        )

    return ExpertCorpus(
        slug=slug,
        folder_name=folder_name,
        files=files,
        corpus_version=_corpus_version(files),
    )
