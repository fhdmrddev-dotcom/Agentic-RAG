"""Expert install — copy a first-party Expert's corpus into ONE org (Phase 266 / PACK-18, PACK-19).

When an org admin presses Install, the Expert's sample corpus (``app/experts/corpora/<slug>/``,
see ``expert_corpus.py``) is copied into the caller's ACTIVE org as an ordinary, org-shared
Library folder, and every file goes through the ONE ingest path a person's upload takes. The
Expert then resolves its knowledge from that org's own copy (``resolve_expert_bundle`` reads
``expert_installs``). ⛔ No cross-tenant read path exists: the bytes come from the repo, never
from another org's rows.

⛔ WHERE THE ORG COMES FROM. Only from the caller's validated active org
  (``Depends(get_active_org_id)`` in the route — a spoofed ``X-Org-Id`` is a 403 before this
  module runs). It is passed EXPLICITLY to the folder insert, to every
  ``async_mint_document_row`` and to ``_enqueue_or_splice`` (which hands it to
  ``insert_ingestion_job``). Omitted anywhere, the mig-106 trigger would pick an arbitrary org
  for a person in two orgs (RESEARCH Pitfall 1 / C-8).

⛔ WHICH CLIENT WRITES WHAT.
  - Tenant rows (the folder, every document, a failed document's reset) are written with the
    CALLER'S user-JWT client, so RLS ``WITH CHECK`` proves org membership and ownership at the
    database, not just here (D-266-12). The folder carries ``is_org_shared = true``; documents
    have no such column (RESEARCH C-1) and inherit sharing from the folder.
  - The service-role client is used ONLY inside ``_enqueue_or_splice`` for the storage PUT and
    the ingestion job — imported BY NAME, never copied, because its docstring records four
    production defects a copy would reintroduce (BUG-260905-04).
  - ``expert_installs`` is written through the asyncpg pool, with ``org_id`` bound in every
    statement (``app/db/experts.py`` — that predicate IS the tenancy boundary on a BYPASSRLS pool).

⛔ READINESS IS DERIVED, NEVER STORED TWICE (D-266-03). The install row records only what the
  installer knows about the COPY step (``installing`` / ``installed`` / ``failed``). Whether the
  Expert is Ready comes from the corpus documents' own status, which the ingest worker writes and
  which never learns about installs — so there is exactly one writer per fact.

⛔ RE-INSTALL RESTORES, IT NEVER OVERWRITES (D-266-14). A present document is left alone (even if
  a person edited it); only a document missing BY FILENAME is minted; a FAILED document is
  re-driven in place by its owner; a deleted folder is recreated and the install repointed.

⛔ THERE IS DELIBERATELY NO UNINSTALL (D-266-15). Losing the tier already hides the Expert
  (Phase 258), and the copied documents stay as ordinary org content. No audit action type is
  added either (RESEARCH Pitfall 6): ``installed_by`` / ``updated_at`` record who and when.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.db import experts as experts_db
from app.services import ingest_splice
from app.services.expert_corpus import CorpusNotFound, CorpusRefused, has_corpus, load_corpus
from app.services.sources.import_service import _enqueue_or_splice

logger = logging.getLogger(__name__)

InstallStateName = Literal["not_installed", "installing", "ready", "failed"]

#: A claim older than this with nothing in flight is a crashed install (matches the 10-minute
#: stale-claim takeover in ``experts_db.claim_expert_install``).
STALE_CLAIM_AFTER = timedelta(minutes=10)

# ── Fixed sentences. ⛔ Never ``str(exc)``: a driver message can carry hosts, ids or secrets. ──
COPY_FAILED = "The copy step failed before every document was queued."
NOT_INSTALLABLE = "Only a first-party Expert that ships sample knowledge can be installed."
FOLDER_NOT_OWNED = (
    "This Expert's knowledge folder belongs to the admin who first installed it. "
    "Ask them to retry the install."
)
REDRIVE_NOT_OWNER = (
    "A sample document failed to process and only the admin who installed it can retry it. "
    "Ask them to retry the install."
)
DOC_FAILED_FALLBACK = "A sample document could not be processed."
STALE_INSTALL = "The install did not finish. Retry to continue it."
NO_SEARCHABLE_TEXT = "A document finished with no searchable text."


# ── Wire models (FROZEN — plan 266-04 builds against exactly these field names) ─────────────


class ExpertInstallState(BaseModel):
    state: InstallStateName
    folder_id: UUID | None = None
    cause: str | None = None
    cause_source: Literal["document", "install"] | None = None
    can_install: bool = False
    updated_at: datetime | None = None


class ExpertInstallResult(BaseModel):
    expert_bundle_id: UUID
    corpus_version: str
    install: ExpertInstallState


class ExpertInstallSummary(BaseModel):
    expert_bundle_id: UUID
    expert_name: str
    folder_id: UUID
    state: InstallStateName


# ── Named refusals ───────────────────────────────────────────────────────────────────────────


class _InstallRefusal(Exception):
    """Base for refusals that carry one fixed, human sentence."""

    def __init__(self, sentence: str) -> None:
        super().__init__(sentence)
        self.sentence = sentence


class ExpertNotInstallable(_InstallRefusal):
    """The bundle is not first-party, or ships no corpus."""


class ExpertInstallConflict(_InstallRefusal):
    """A copy of a corpus file already exists in this org OUTSIDE the install folder."""


class ExpertInstallFolderNotOwned(_InstallRefusal):
    """The install folder belongs to another admin, so the caller cannot add documents to it."""


# ── Derived state ────────────────────────────────────────────────────────────────────────────


def derive_install_state(
    install: dict[str, Any] | None,
    docs: list[dict[str, Any]],
    *,
    filenames: list[str],
    can_install: bool,
    now: datetime | None = None,
) -> ExpertInstallState:
    """Not installed / Installing / Ready / Failed, derived at READ time (D-266-03).

    ⛔ Readiness has ONE source of truth: the corpus documents' own ``status`` /
    ``chunk_count`` / ``error_message``, written by the ingest worker — which never learns about
    installs. The install row contributes only what the INSTALLER knows about the copy step
    (``installing`` / ``installed`` / ``failed`` + its fixed-sentence ``error``). A stored
    ``ready`` would need a second writer racing the worker, so there is none.

    Order (each arm returns):
      1. no install row → not_installed;
      2. a fresh ``installing`` claim (< 10 min) → installing;
      3. a ``failed`` copy step → failed, cause from the install row (even with no folder yet —
         a copy that died before its folder existed is a failure with a cause, never a silent
         "not installed");
      4. the folder is gone → a stale claim is failed(retry), anything else is not_installed so
         Install can recreate it (D-266-14);
      5. a stale ``installing`` claim with no corpus document in flight → failed(retry)
         (RESEARCH Pitfall 4 — never "Installing…" forever);
      6. a present corpus document failed → failed, cause from THAT document;
      7. a present corpus document still in flight → installing;
      8. no present corpus document → not_installed (a person deleted them; Install restores);
      9. a completed document with no chunks → failed (nothing searchable);
     10. otherwise every present corpus document completed with chunks → ready.
    """
    if install is None:
        return ExpertInstallState(state="not_installed", can_install=can_install)

    now = now or datetime.now(timezone.utc)
    updated_at = install.get("updated_at")
    status = install.get("status")
    folder_ok = bool(install.get("folder_id")) and install.get("folder_exists", True) is not False
    folder_id = install.get("folder_id") if folder_ok else None

    fresh = False
    if isinstance(updated_at, datetime):
        stamp = updated_at if updated_at.tzinfo else updated_at.replace(tzinfo=timezone.utc)
        fresh = now - stamp < STALE_CLAIM_AFTER

    def _state(state: InstallStateName, cause: str | None = None, source: Any = None) -> ExpertInstallState:
        return ExpertInstallState(
            state=state,
            folder_id=folder_id if state != "not_installed" else None,
            cause=cause,
            cause_source=source,
            can_install=can_install,
            updated_at=updated_at,
        )

    if status == "installing" and fresh:
        return _state("installing")
    if status == "failed":
        return _state("failed", install.get("error") or COPY_FAILED, "install")
    if not folder_ok:
        if status == "installing":
            return _state("failed", STALE_INSTALL, "install")
        return _state("not_installed")

    wanted = set(filenames)
    present = [d for d in docs if d.get("filename") in wanted and _same_folder(d, folder_id)]
    in_flight = [d for d in present if d.get("status") not in ("completed", "failed")]

    if status == "installing" and not in_flight:
        return _state("failed", STALE_INSTALL, "install")
    failed = [d for d in present if d.get("status") == "failed"]
    if failed:
        return _state("failed", failed[0].get("error_message") or DOC_FAILED_FALLBACK, "document")
    if in_flight:
        return _state("installing")
    if not present:
        return _state("not_installed")
    if any(not (d.get("chunk_count") or 0) > 0 for d in present):
        return _state("failed", NO_SEARCHABLE_TEXT, "install")
    return _state("ready")


def _same_folder(doc: dict[str, Any], folder_id: Any) -> bool:
    """A doc without a folder key is trusted (the caller already filtered by folder)."""
    if "folder_id" not in doc or folder_id is None:
        return True
    return str(doc.get("folder_id")) == str(folder_id)


async def _corpus_filenames(slug: str | None) -> list[str] | None:
    """The corpus's manifest filenames, or ``None`` when the slug ships no corpus."""
    if not slug:
        return None

    def _read() -> list[str] | None:
        if not has_corpus(slug):
            return None
        try:
            return [f.filename for f in load_corpus(slug).files]
        except (CorpusRefused, CorpusNotFound):
            return None

    return await run_in_threadpool(_read)


async def _read_state(
    pool: Any,
    *,
    org_id: UUID,
    bundle_id: UUID,
    filenames: list[str],
    can_install: bool,
) -> ExpertInstallState:
    """Re-read the install row and its corpus documents, then derive (never trust a cache)."""
    install = await experts_db.get_expert_install(pool, org_id=org_id, bundle_id=bundle_id)
    docs: list[dict[str, Any]] = []
    if install and install.get("folder_id") and install.get("folder_exists"):
        docs = await experts_db.list_install_corpus_documents(
            pool, org_id=org_id, folder_ids=[install["folder_id"]], filenames=filenames
        )
    return derive_install_state(install, docs, filenames=filenames, can_install=can_install)


async def _states_for_installs(
    pool: Any,
    *,
    org_id: UUID,
    installs: list[dict[str, Any]],
    filenames_by_bundle: dict[str, list[str]],
    can_install: bool,
) -> dict[str, ExpertInstallState]:
    """Derive the state of many installs with AT MOST ONE document read for the whole set."""
    folder_ids: list[UUID] = []
    all_names: set[str] = set()
    for inst in installs:
        key = str(inst.get("expert_bundle_id"))
        if key in filenames_by_bundle and inst.get("folder_id") and inst.get("folder_exists", True) is not False:
            fid = inst["folder_id"]
            folder_ids.append(fid if isinstance(fid, UUID) else UUID(str(fid)))
            all_names.update(filenames_by_bundle[key])

    docs: list[dict[str, Any]] = []
    if folder_ids and all_names:
        docs = await experts_db.list_install_corpus_documents(
            pool, org_id=org_id, folder_ids=folder_ids, filenames=sorted(all_names)
        )

    out: dict[str, ExpertInstallState] = {}
    for inst in installs:
        key = str(inst.get("expert_bundle_id"))
        if key not in filenames_by_bundle:
            continue
        mine = [d for d in docs if str(d.get("folder_id")) == str(inst.get("folder_id"))]
        out[key] = derive_install_state(
            inst, mine, filenames=filenames_by_bundle[key], can_install=can_install
        )
    return out


async def overlay_install_state(
    pool: Any,
    rows: list[dict[str, Any]],
    *,
    org_id: UUID,
    can_install: bool,
) -> list[dict[str, Any]]:
    """Tell every first-party Expert row its org's install state (D-266-09, Pattern 5).

    - A list with NO ``is_system`` row is returned as-is with ZERO queries.
    - Otherwise: ONE install read for the org and AT MOST ONE document read for the whole list;
      each distinct slug's manifest is read once per call (file I/O in the threadpool).
    - A first-party row with a corpus gains ``install`` and has ``knowledge_folder_ids``
      REPLACED by ``[install folder]`` (installing / ready / failed with a folder) or ``[]`` —
      so the five surfaces that count folders tell the truth with no edit, and the retired
      global seed id (migration 188's …0260) can never survive into a response.
    - A first-party row with no corpus gains ``install: None`` and ``knowledge_folder_ids: []``.
    - Org-authored rows are returned untouched, with no ``install`` key.

    Every row is COPIED before it is changed. System bundles are not tenant-writable
    (``expert_bundles_write_policy``), so the overlaid ids can never round-trip into an update.
    """
    if not any(r.get("is_system") for r in rows):
        return rows

    filenames_by_slug: dict[str, list[str] | None] = {}
    for r in rows:
        slug = r.get("slug")
        if r.get("is_system") and slug not in filenames_by_slug:
            filenames_by_slug[slug] = await _corpus_filenames(slug)

    installs = await experts_db.list_expert_installs_for_org(pool, org_id=org_id)
    by_bundle = {str(i.get("expert_bundle_id")): i for i in installs}

    filenames_by_bundle: dict[str, list[str]] = {}
    for r in rows:
        names = filenames_by_slug.get(r.get("slug")) if r.get("is_system") else None
        if names is not None:
            filenames_by_bundle[str(r.get("id"))] = names

    states = await _states_for_installs(
        pool,
        org_id=org_id,
        installs=[by_bundle[k] for k in filenames_by_bundle if k in by_bundle],
        filenames_by_bundle=filenames_by_bundle,
        can_install=can_install,
    )

    out: list[dict[str, Any]] = []
    for r in rows:
        if not r.get("is_system"):
            out.append(r)
            continue
        row = dict(r)
        key = str(r.get("id"))
        if key not in filenames_by_bundle:
            row["install"] = None
            row["knowledge_folder_ids"] = []
            out.append(row)
            continue
        state = states.get(key) or ExpertInstallState(state="not_installed", can_install=can_install)
        row["install"] = state.model_dump()
        row["knowledge_folder_ids"] = (
            [state.folder_id] if state.state != "not_installed" and state.folder_id is not None else []
        )
        out.append(row)
    return out


async def list_install_summaries(pool: Any, *, org_id: UUID) -> list[ExpertInstallSummary]:
    """One summary per install in the org whose folder still exists (the Library provenance note).

    ``org_id`` is the caller's validated active org; the read is bound to it in SQL.
    """
    installs = [
        i for i in await experts_db.list_expert_installs_for_org(pool, org_id=org_id)
        if i.get("folder_id") and i.get("folder_exists", True) is not False
    ]
    filenames_by_bundle: dict[str, list[str]] = {}
    for inst in installs:
        names = await _corpus_filenames(inst.get("expert_slug"))
        # An install whose Expert no longer ships a corpus still owns a real folder, so it is
        # listed (the Library note stays true) with no manifest to derive against.
        filenames_by_bundle[str(inst.get("expert_bundle_id"))] = names or []

    states = await _states_for_installs(
        pool, org_id=org_id, installs=installs, filenames_by_bundle=filenames_by_bundle, can_install=False
    )
    out: list[ExpertInstallSummary] = []
    for inst in installs:
        key = str(inst.get("expert_bundle_id"))
        state = states.get(key)
        out.append(
            ExpertInstallSummary(
                expert_bundle_id=inst["expert_bundle_id"],
                expert_name=inst.get("expert_name") or "",
                folder_id=inst["folder_id"],
                state=state.state if state else "not_installed",
            )
        )
    return out


# ── The installer ────────────────────────────────────────────────────────────────────────────


def _is_reclaim(claim: dict[str, Any]) -> bool:
    """True when the claim took over an EXISTING install row (a re-install), not a fresh insert."""
    created, updated = claim.get("created_at"), claim.get("updated_at")
    return created is not None and updated is not None and created != updated


async def _ensure_folder(
    *,
    pool: Any,
    supabase: Any,
    claim: dict[str, Any],
    folder_name: str,
    org_id: UUID,
    user_id: UUID,
    bundle_id: UUID,
) -> str:
    """Reuse the install's folder when it still exists in this org; otherwise create + repoint."""
    claimed_folder = claim.get("folder_id")
    if claimed_folder:
        res = await run_in_threadpool(
            lambda: supabase.table("folders")
            .select("id")
            .eq("id", str(claimed_folder))
            .eq("org_id", str(org_id))
            .maybe_single()
            .execute()
        )
        if res is not None and getattr(res, "data", None):
            return str(claimed_folder)

    inserted = await run_in_threadpool(
        lambda: supabase.table("folders")
        .insert(
            {
                "user_id": str(user_id),
                "org_id": str(org_id),
                "name": folder_name,
                "parent_id": None,
                # ⛔ On the FOLDER only — documents inherit sharing from it (RESEARCH C-1).
                "is_org_shared": True,
            }
        )
        .execute()
    )
    new_folder_id = str(inserted.data[0]["id"])
    await experts_db.set_expert_install_folder(
        pool, org_id=org_id, bundle_id=bundle_id, folder_id=UUID(new_folder_id), installed_by=user_id
    )
    if claimed_folder or _is_reclaim(claim):
        logger.info(
            "EXPERT_INSTALL_FOLDER_RECREATED: org %s bundle %s folder %s -> %s",
            org_id, bundle_id, claimed_folder, new_folder_id,
        )
    else:
        logger.info("EXPERT_INSTALL_FOLDER_CREATED: org %s bundle %s folder %s", org_id, bundle_id, new_folder_id)
    return new_folder_id


async def _redrive_failed(
    *,
    supabase: Any,
    row: dict[str, Any],
    raw: bytes,
    mime_type: str,
    filename: str,
    org_id: UUID,
    user_id: UUID,
    background_tasks: BackgroundTasks,
) -> None:
    """Re-drive a FAILED corpus document IN PLACE (the /reingest shape, documents.py).

    Prior artefacts are deleted first (children before parent, as /reingest step 3 does) so a
    re-drive never accumulates chunks, then the row is reset to ``pending`` filtered by id AND
    owner, then it is handed to the queue. ⚠ Diverges from /reingest at its last step:
    /reingest schedules the legacy ``_upload_pipeline``; this uses ``_enqueue_or_splice``, whose
    storage PUT to an existing key falls back to a direct splice with the bytes in memory —
    still the one pipeline, never a stranded document.
    """
    doc_id = str(row["id"])
    for child in ("document_chunks", "document_tables", "document_images"):
        await run_in_threadpool(
            lambda child=child: supabase.table(child).delete().eq("document_id", doc_id).execute()
        )
    await run_in_threadpool(
        lambda: supabase.table("documents")
        .update({"status": "pending", "error_message": None})
        .eq("id", doc_id)
        .eq("user_id", str(user_id))
        .execute()
    )
    await _enqueue_or_splice(
        doc=row,
        raw=raw,
        mime_type=mime_type,
        filename=filename,
        user_id=str(user_id),
        active_org=str(org_id),
        storage_path=row["file_path"],
        background_tasks=background_tasks,
    )
    logger.info("EXPERT_INSTALL_FILE_REDRIVEN: org %s document %s (%s)", org_id, doc_id, filename)


async def _mark_failed(pool: Any, *, org_id: UUID, bundle_id: UUID, sentence: str) -> None:
    """Record a failed copy step. Never masks the original exception."""
    try:
        await experts_db.set_expert_install_status(
            pool, org_id=org_id, bundle_id=bundle_id, status="failed", error=sentence
        )
    except Exception:  # noqa: BLE001
        logger.exception("EXPERT_INSTALL_FAILED: could not record the failure for org %s bundle %s", org_id, bundle_id)


async def install_expert(
    *,
    pool: Any,
    supabase: Any,
    bundle: dict[str, Any],
    org_id: UUID,
    user_id: UUID,
    can_install: bool,
    background_tasks: BackgroundTasks,
) -> ExpertInstallResult:
    """Copy ``bundle``'s corpus into ``org_id`` through the one ingest path, idempotently."""
    bundle_id = bundle["id"] if isinstance(bundle["id"], UUID) else UUID(str(bundle["id"]))
    slug = bundle.get("slug")

    # 1. Only a first-party Expert with a shipped corpus. Refused before ANY write.
    if not bundle.get("is_system") or not slug or not await run_in_threadpool(has_corpus, slug):
        raise ExpertNotInstallable(NOT_INSTALLABLE)

    # 2. The corpus (file I/O → threadpool, D-v2.5-01).
    try:
        corpus = await run_in_threadpool(load_corpus, slug)
    except (CorpusRefused, CorpusNotFound) as exc:
        raise ExpertNotInstallable(NOT_INSTALLABLE) from exc
    filenames = [f.filename for f in corpus.files]

    # 3. Race-safe claim. None = another worker holds it: report, write nothing.
    claim = await experts_db.claim_expert_install(
        pool, org_id=org_id, bundle_id=bundle_id, installed_by=user_id, corpus_version=corpus.corpus_version
    )
    if claim is None:
        logger.info("EXPERT_INSTALL_CLAIM_LOST: org %s bundle %s", org_id, bundle_id)
        state = await _read_state(
            pool, org_id=org_id, bundle_id=bundle_id, filenames=filenames, can_install=can_install
        )
        return ExpertInstallResult(
            expert_bundle_id=bundle_id, corpus_version=corpus.corpus_version, install=state
        )
    logger.info("EXPERT_INSTALL_CLAIMED: org %s bundle %s by %s", org_id, bundle_id, user_id)

    try:
        # 4. The folder.
        folder_id = await _ensure_folder(
            pool=pool,
            supabase=supabase,
            claim=claim,
            folder_name=corpus.folder_name,
            org_id=org_id,
            user_id=user_id,
            bundle_id=bundle_id,
        )

        # 5. What is already there, by filename, in THIS org's install folder.
        existing = await experts_db.list_install_corpus_documents(
            pool, org_id=org_id, folder_ids=[UUID(folder_id)], filenames=filenames
        )
        by_name = {d["filename"]: d for d in existing}

        # 6. Per corpus file: skip / re-drive / mint.
        not_owner_cause: str | None = None
        for f in corpus.files:
            row = by_name.get(f.filename)
            if row is not None and row.get("status") != "failed":
                continue  # ⛔ present (possibly edited) — never overwritten (D-266-14)
            if row is not None:
                if str(row.get("user_id")) == str(user_id):
                    await _redrive_failed(
                        supabase=supabase,
                        row=row,
                        raw=f.raw,
                        mime_type=f.mime_type,
                        filename=f.filename,
                        org_id=org_id,
                        user_id=user_id,
                        background_tasks=background_tasks,
                    )
                else:
                    not_owner_cause = REDRIVE_NOT_OWNER
                continue

            mint = await ingest_splice.async_mint_document_row(
                raw=f.raw,
                filename=f.filename,
                mime_type=f.mime_type,
                user_id=str(user_id),
                supabase=supabase,
                folder_id=folder_id,
                org_id=str(org_id),
                on_conflict="link",
            )
            doc = dict(mint.document)
            if not mint.is_duplicate:
                await _enqueue_or_splice(
                    doc=doc,
                    raw=f.raw,
                    mime_type=f.mime_type,
                    filename=f.filename,
                    user_id=str(user_id),
                    active_org=str(org_id),
                    storage_path=mint.storage_path,
                    background_tasks=background_tasks,
                )
                logger.info("EXPERT_INSTALL_FILE_MINTED: org %s document %s (%s)", org_id, doc.get("id"), f.filename)
            elif str(doc.get("org_id")) != str(org_id) or str(doc.get("folder_id")) != folder_id:
                # ⛔ Never adopt a copy that is not this org's install folder.
                raise ExpertInstallConflict(
                    f"A copy of {f.filename} already exists elsewhere in this organisation's "
                    "Library, so the install could not add it to the Expert's folder."
                )

        # 7. The copy step's own verdict.
        if not_owner_cause:
            await experts_db.set_expert_install_status(
                pool, org_id=org_id, bundle_id=bundle_id, status="failed", error=not_owner_cause
            )
        else:
            await experts_db.set_expert_install_status(
                pool, org_id=org_id, bundle_id=bundle_id, status="installed", error=None
            )
    except HTTPException as exc:
        if exc.status_code == 403:
            await _mark_failed(pool, org_id=org_id, bundle_id=bundle_id, sentence=FOLDER_NOT_OWNED)
            raise ExpertInstallFolderNotOwned(FOLDER_NOT_OWNED) from exc
        await _mark_failed(pool, org_id=org_id, bundle_id=bundle_id, sentence=COPY_FAILED)
        raise
    except _InstallRefusal as exc:
        await _mark_failed(pool, org_id=org_id, bundle_id=bundle_id, sentence=exc.sentence)
        raise
    except Exception:
        logger.exception("EXPERT_INSTALL_FAILED: org %s bundle %s", org_id, bundle_id)
        await _mark_failed(pool, org_id=org_id, bundle_id=bundle_id, sentence=COPY_FAILED)
        raise

    state = await _read_state(pool, org_id=org_id, bundle_id=bundle_id, filenames=filenames, can_install=can_install)
    return ExpertInstallResult(expert_bundle_id=bundle_id, corpus_version=corpus.corpus_version, install=state)
