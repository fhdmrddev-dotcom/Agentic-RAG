"""The ``execute_code`` tool: bounded sandbox commands, declared-library install, thread
attachment hydration, missing-module autoheal and the Phase 142 completed-run reshaping.

Moved VERBATIM out of ``tool_dispatcher.py`` in Phase 278 (SEAM-03, a pure move): every binding
here is AST-identical to its PHASE_BASE source, proven by ``tests/unit/test_278_pure_move.py``.
``tool_dispatcher.py`` keeps the registry: it imports the handlers below BY NAME into its static
``_TOOL_REGISTRY`` literal (Extension Contract — never registered dynamically).

⚠ PATCH-WHERE-USED: the bodies in this module resolve these names from THIS module's globals —
``run_in_threadpool``, ``aexec``, ``write_audit_entry``, ``sandbox_manager``,
``harvest_output_files``, ``snapshot_output_baseline``, ``settings``, ``ws_list_files``,
``WorkspaceError``, ``_get_file_content``, ``get_file_by_path``, ``KNOWN_MISSING_MODULES``,
``_NO_MODULE_RE``, ``_classify_runtime_gap``, ``_code_references_dead_token``,
``_repeat_blocked_result``, ``_resolve_skill_visibility_or``. Patch
``app.services.tools.sandbox.<name>``; a patch of the same name on ``tool_dispatcher`` no longer
reaches the code that calls it (and, because the registry module no longer imports them, raises
``AttributeError`` instead of silently patching nothing).

``_attachment_container_path`` is re-exported from ``tool_dispatcher`` for ``agent_loop`` (D-04).

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). Cross-family helpers are imported BY NAME from their
``app.services.tools.<family>`` home, never through the dispatcher.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import shlex
import time as time_mod
import weakref
from uuid import UUID

from starlette.concurrency import run_in_threadpool

from app.utils.db import aexec
from app.services.audit_service import write_audit_entry
from app.services.sandbox_service import (
    sandbox_manager,
    harvest_output_files,
    snapshot_output_baseline,
)
from app.config import settings
from app.services.workspace_service import (
    list_files as ws_list_files,
    WorkspaceError,
    _get_file_content,
    get_file_by_path,
)
from app.services.tools.base import ToolContext, ToolResult
from app.services.tools.skills import _resolve_skill_visibility_or
from app.services.tools.runtime_gap import (
    KNOWN_MISSING_MODULES,
    _NO_MODULE_RE,
    _classify_runtime_gap,
    _code_references_dead_token,
    _repeat_blocked_result,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# EXEC-01 (Phase 176-03 / D-01..D-04) — reliable declared-library install +
# bounded ModuleNotFound auto-heal, ENTIRELY inside the tool dispatcher (below the
# provider adapter boundary → provider-uniform, Deep byte-identical). See
# `_handle_execute_code` for the wiring; the run-scoped heal-bound helpers live at
# `_heal_bound_seen` / `_heal_bound_record` alongside `_NO_MODULE_RE`.
# ---------------------------------------------------------------------------
def _pip_install(session, libs: "list[str]"):
    """Install `libs` into the SANDBOX SYSTEM interpreter via `python -m pip`.

    Deliberately NOT `session.install(...)`: (A) `session.install` swallows pip
    failures (returns None on a non-zero exit — our try/except was dead code) and
    (B) it targets the venv pip, whose site-packages are invisible to the code run
    (`python -u <file>` = the SYSTEM interpreter). Running `python -m pip` here
    matches the run interpreter AND — with NO on_stdout/on_stderr callbacks — makes
    `session.execute_command` NON-streaming, so `ConsoleOutput.exit_code` and
    `.stderr` are RELIABLE. SYNCHRONOUS/blocking → call via `run_in_threadpool`.
    """
    joined = " ".join(shlex.quote(lib) for lib in libs)
    return session.execute_command(
        f"python -m pip install --disable-pip-version-check {joined}"
    )


class _SandboxCommandTimeout(Exception):
    """A bounded blocking sandbox call exceeded its wall-clock ceiling and the
    container was killed to free the wedged (uncancellable) thread (096/SEED-063).
    Carries the ceiling so the caller can build an honest aborted message."""

    def __init__(self, timeout_s):
        self.timeout_s = timeout_s
        super().__init__(f"sandbox command exceeded {timeout_s}s wall-clock limit")


async def _run_bounded_sandbox(func, *args, thread_id, timeout_s):
    """Run a BLOCKING sandbox call ``func(*args)`` off the event loop, bounded by a
    wall-clock ``timeout_s`` (``None``/``<=0`` disables the cap — operator escape hatch,
    mirrors the primary run at ``:1784``).

    A Python thread blocked in ``session.execute_command`` cannot be cancelled, so on
    overrun this KILLS the sandbox container (the only way to free the thread — 096 /
    SEED-063), abandons the orphaned future (retrieving its eventual exception in a
    done-callback so asyncio doesn't log "exception never retrieved"), and raises
    ``_SandboxCommandTimeout``. Uses ``asyncio.wait`` (which never cancels the future
    itself) rather than ``asyncio.wait_for`` so the abandoned thread keeps running
    harmlessly until the kill lands, exactly like the primary drain loop. Returns the
    call's result when it completes within the ceiling.
    """
    loop = asyncio.get_running_loop()
    fut = loop.run_in_executor(None, func, *args)
    if not timeout_s or timeout_s <= 0:
        return await fut
    done, _pending = await asyncio.wait({fut}, timeout=timeout_s)
    if not done:
        logger.warning(
            "bounded sandbox command wall-clock timeout (%ss) thread=%s — "
            "killing sandbox container", timeout_s, thread_id,
        )
        try:
            await run_in_threadpool(sandbox_manager.kill_session, thread_id)
        except Exception:  # noqa: BLE001 — abort path never raises
            logger.exception(
                "kill_session failed after bounded-command timeout thread=%s", thread_id,
            )
        fut.add_done_callback(lambda f: f.cancelled() or f.exception())
        raise _SandboxCommandTimeout(timeout_s)
    return fut.result()


async def _install_declared_libraries(
    session, libraries: "list[str]", *, thread_id=None, timeout_s=None,
) -> str:
    """Install declared `libraries` deterministically; retry ONCE on a non-zero exit.

    Returns the pip stderr IFF the install STILL failed after the retry (else "") so
    the caller can carry the honest reason into the tool result — NEVER silently
    swallowed (D-01/D-02.1). A thread-side raise is surfaced as the reason too.

    CR-01 (176): each blocking `pip install` is routed through `_run_bounded_sandbox`
    so a hung install (network stall) can't wedge the run forever — a wall-clock
    overrun kills the container and surfaces an honest aborted reason, mirroring the
    primary run's wall-clock abort. `thread_id`/`timeout_s` default to no-bound so
    unit callers stay unchanged.
    """
    try:
        res = await _run_bounded_sandbox(
            _pip_install, session, libraries, thread_id=thread_id, timeout_s=timeout_s)
        if getattr(res, "exit_code", 0):
            res = await _run_bounded_sandbox(  # retry once
                _pip_install, session, libraries, thread_id=thread_id, timeout_s=timeout_s)
        if getattr(res, "exit_code", 0):
            return (getattr(res, "stderr", "") or "") or "pip install exited non-zero"
        return ""
    except _SandboxCommandTimeout as _t:  # CR-01 — hung install killed + surfaced honestly
        logger.warning("declared pip install exceeded wall-clock limit: %s", _t)
        return (
            f"pip install exceeded the {_t.timeout_s}s wall-clock limit and was "
            "aborted (the sandbox container was killed to free it)."
        )
    except Exception as _e:  # noqa: BLE001 — surface, never swallow (D-01)
        logger.warning("declared pip install raised thread-side: %s", _e)
        return f"{type(_e).__name__}: {_e}"


# Error markers that force a stdout-only "success" to be reclassified as a failure
# (the streamed exit code from a bare `python -u` run is always 0 — Defect C). Hoisted
# to module scope so both the initial derivation and the post-heal re-derivation share
# one definition.
_EXEC_ERROR_MARKERS = (
    "Traceback (most recent call last)",
    "Error:",
    "Exception:",
    "ModuleNotFoundError",
    "ImportError",
    "SyntaxError",
    "NameError",
    "TypeError",
    "ValueError",
    "RuntimeError",
    "AttributeError",
    "KeyError",
    "IndexError",
)


def _derive_actual_exit_code(exec_result) -> int:
    """Derive the effective exit code: a bare `python -u` run streams exit_code 0
    even on a Python traceback (Defect C), so an exit-0 run whose stdout carries a
    Python error marker is bumped to 1."""
    code = getattr(exec_result, "exit_code", None) or 0
    if code == 0:
        stdout_text = getattr(exec_result, "stdout", "") or ""
        if any(m in stdout_text for m in _EXEC_ERROR_MARKERS):
            return 1
    return code


# ── Phase 244 (SHELL-04 / C-9) — thread attachments reach the sandbox ─────────
#
# WHY THIS EXISTS. `244-CONTEXT.md` said "nothing new is needed on the tool side". Measured at
# this base that is TRUE FOR TEXT and FALSE FOR BINARY: `workspace_service.read_file` returns the
# literal "Content available via REST API." for any binary MIME (:391-402), and the sandbox had NO
# workspace reach at all (`grep -rn "workspace" sandbox_service.py` -> no matches). EIGHT of the
# sixteen accepted extensions are binary, and sketch 236's headline scenario file is an .xlsx — so
# SHELL-04's "and the agent can use it" clause was unsatisfied for the MOST LIKELY attachments.
#
# ⛔ `workspace_read`'s binary branch is DELIBERATELY LEFT ALONE. Its note is honest for a
# text-reading tool; this is a SECOND, correct route rather than making the first one lie.
_ATTACHMENTS_DIR = "/sandbox/attachments"

# A bound on container I/O per session. The 10 MB per-file cap is enforced at the upload door
# (three times, including before body materialisation — WR-04), but nothing caps the COUNT of
# workspace rows a thread can accumulate, and the agent writes here too. A truncation is NAMED in
# the tool result, never silent (the `confirm_preview` refusal discipline).
_ATTACHMENT_HYDRATION_MAX_FILES = 50

# A bound on the BASENAME. ⚠ Found by the Task-3 prompt fence, not by this task's own tests: a
# 4,000-character filename produced a 4,000-character container path AND flooded the turn's system
# prompt, because nothing here capped length. Most filesystems refuse a component over 255 bytes,
# so an unbounded name is also an ENOENT the agent cannot diagnose. The tail is cut, never the
# head — workspace paths carry a `uuid8-` prefix, so truncation keeps names distinguishable.
_ATTACHMENT_NAME_MAX = 120

# WR-02 (244-07) / L-5 defect 6b (244-10). A per-session record of WHICH workspace paths were
# copied — not merely THAT hydration ran — keyed on the SANDBOX SESSION rather than on the
# per-iteration `ToolContext`.
#
# ⛔ WHY THE TYPE CHANGED, measured in a real browser and not reasoned about. `244-07` closed
# WR-02 with a `weakref.WeakSet` of sessions: hydration ran ONCE, on the call that created the
# entry. That is right for the DoS arm WR-02 named and WRONG for this one, because
# `SandboxSessionManager` caches the session per `thread_id` until idle eviction — so once a
# session was marked, NO LATER ATTACHMENT WAS EVER COPIED INTO IT. The agent's own round-4
# output is the evidence:
#       /sandbox/attachments [] ['c679b991-Meridian-Q4-pricing.xlsx']
# — the directory holds only the first file. It recovered the second at round 10 via the
# `workspace_read` fallback, ~49 s and ~10 wasted rounds later. ⛔ "The SECOND attachment did not
# hydrate", never ".pdf does not hydrate": that run attached .xlsx first and .pdf second, so
# ordering is confounded with file type and the type-specific claim is NOT established.
#
# ⭐ THE RECORD NOW SAYS WHICH FILES, so a claim about hydration can never again outlive the
# files it was about. WR-02's DoS arm survives at per-FILE granularity: an already-copied path is
# still never copied twice.
#
# ⚠ THREE PROPERTIES ARE INHERITED FROM WR-02 RATHER THAN RE-ARGUED HERE:
#   1. **keyed by the SESSION**, so the record's lifetime is exactly the lifetime of the
#      `/sandbox/attachments` directory it describes — a new container (worker bounce, idle
#      eviction) is a new key with an empty set and re-hydrates, correct rather than incidental;
#   2. **weak**, so the record cannot pin a session alive;
#   3. **membership/keying, NEVER `getattr`** — `setattr(session, flag, True)` works on the real
#      object but `getattr(mock, flag, False)` on a `MagicMock` returns an auto-created child
#      mock, which is TRUTHY, so an attribute-based guard reads "already hydrated" on the very
#      first call and cannot be fenced at all.
_hydrated_files: "weakref.WeakKeyDictionary[object, set[str]]" = weakref.WeakKeyDictionary()

# ⭐ 244-14 (review WR-03) — THE SECOND HALF OF THE RECORD: how many times each path has FAILED
# in this session. `_hydrated_files` above is now strictly *"do not attempt this path again"*
# (succeeded, or deliberately given up on); this one is *"attempted and failed, N times"*.
#
# ⛔ WHY BOTH ARE NEEDED, rather than one set recorded before the attempt. `244-10` added the
# path to `already` BEFORE the try, so a file that failed ONCE was treated as copied for the
# life of the ~30-minute cached session. Its justification — *"its failure is already named
# individually below, so nothing is lost"* — is only true of the call the failure happened in:
# every LATER call filters the path out before the loop, so no note is produced and the model is
# told nothing at all. And the `except` catches EVERY exception, while the realistic failure set
# here is dominated by transients (Supabase Storage, the pg pool, the Docker daemon).
#
# ⛔ THE DoS BOUND THE DEVIATION WAS PROTECTING IS KEPT — it just comes from a CAP instead of
# from never retrying. A permanently-broken file costs at most `_ATTACHMENT_HYDRATION_MAX_ATTEMPTS`
# attempts per SESSION, then enters `_hydrated_files` and is never touched again.
#
# ⚠ Same three properties as `_hydrated_files`, for the same reasons: keyed by the SESSION (so
# the record's lifetime is the container's), WEAK (it cannot pin a session alive), and by
# MEMBERSHIP rather than `getattr` (a `MagicMock` auto-creates truthy children).
_hydration_failures: "weakref.WeakKeyDictionary[object, dict[str, int]]" = weakref.WeakKeyDictionary()

# ⛔ How many times one path may be attempted in a session before it is given up on. 2 is
# deliberate and minimal: it converts "a single blip costs the file for 30 minutes" into "a
# single blip costs one extra attempt", without turning a genuinely broken row into an unbounded
# per-call DB read plus container write. Driven by case F2.
_ATTACHMENT_HYDRATION_MAX_ATTEMPTS = 2


def _session_hydration_records(session) -> "tuple[set[str], dict[str, int]]":
    """The two per-session hydration records for ``session``, created on first use.

    ⭐ ONE resolver for BOTH records, so the caller cannot acquire one and forget the other, and
    so the ``TypeError`` degradation for a non-weak-referenceable session lives in one place.
    That degradation returns throw-away records, which reproduces the pre-244-10 behaviour
    (re-copy every call) rather than breaking the turn — over-copying, never under-.
    """
    try:
        copied = _hydrated_files.get(session)
        if copied is None:
            copied = set()
            _hydrated_files[session] = copied
        failed = _hydration_failures.get(session)
        if failed is None:
            failed = {}
            _hydration_failures[session] = failed
        return copied, failed
    except TypeError:  # pragma: no cover — a session that cannot be weak-referenced
        logger.warning("attachment hydration: session is not weak-referenceable")
        return set(), {}


def _attachment_container_path(path: str) -> str:
    """Reduce an attacker-controlled workspace path to a BASENAME under ``_ATTACHMENTS_DIR``.

    ⛔ T-244-02-02. A filename is attacker-controlled text and this value becomes a CONTAINER
    PATH; an f-string of the raw path writes wherever the caller likes. Four reductions, in
    order, each load-bearing:

      1. backslashes are normalised so a Windows-style separator cannot hide a segment;
      2. ``os.path.basename`` discards every directory segment — ``../../etc/passwd`` -> ``passwd``;
      3. the charset is narrowed to ``validate_path``'s own set, so nothing shell- or
         path-significant survives even if a future basename implementation changed;
      4. leading dots are stripped, so ``..`` cannot survive as a name in its own right, and an
         empty residue falls back to a fixed literal rather than producing the directory itself;
      5. the length is capped (``_ATTACHMENT_NAME_MAX``) — an unbounded component is an ENOENT on
         most filesystems and, since Task 3 announces this exact path, a prompt flood.
    """
    import re as _re_attach  # module-local idiom (see _handle_load_skill / the exec hint)

    candidate = (path or "").replace("\\", "/").rstrip("/")
    base = os.path.basename(candidate)
    base = _re_attach.sub(r"[^A-Za-z0-9._\- ]", "_", base)
    base = base.lstrip(".").strip()
    if len(base) > _ATTACHMENT_NAME_MAX:
        base = base[:_ATTACHMENT_NAME_MAX].strip()
    if not base:
        base = "attachment"
    return f"{_ATTACHMENTS_DIR}/{base}"


async def _hydrate_thread_attachments(
    ctx: ToolContext, session, already: set[str], failed: dict[str, int]
) -> list[str]:
    """Copy this thread's not-yet-copied, non-expired workspace files into ``/sandbox/attachments/``.

    Returns a list of NAMED failure/truncation notes (empty on a clean run) for the caller to
    surface in the tool result. ⛔ T-244-02-07: a file the user attached is never dropped
    silently — a per-file failure is logged AND named, the way `preview_service.confirm_preview`
    names a refusal.

    ⭐ ``already`` IS THE CALLER'S OWN SET (244-10), mutated in place rather than returned and
    re-unioned — the two are equivalent, and passing the live object is what keeps the record
    keyed to the container it describes. ``failed`` is its companion (244-14), and both come from
    ``_session_hydration_records``.

    ⚠ ⛔ CORRECTED BY 244-14 (review WR-03), AND THE ORIGINAL IS KEPT BECAUSE IT WAS CONFIDENTLY
    WRONG. This paragraph used to read: *"A path is recorded the moment it is CLAIMED, so a
    permanently-broken file costs one attempt per SESSION and not one per `execute_code` call;
    its failure is already named individually below, so nothing is lost."* The first clause was
    true. **The second was only true of the call the failure happened in** — every later call
    filters the path out before the loop, so no note is produced and the model is told NOTHING.
    And the ``except`` catches every exception, while the realistic failure set here is dominated
    by TRANSIENTS. One Supabase blip therefore cost the person's file for the whole ~30-minute
    session, in silence: the identical shape of the defect 6b this function was rewritten to fix.

    ⭐ SO: ``already`` is written on SUCCESS, or on the give-up arm after
    ``_ATTACHMENT_HYDRATION_MAX_ATTEMPTS`` failures. The DoS bound the original was protecting is
    kept — it is now paid for by a CAP rather than by never retrying — and the failure is NAMED
    on every attempt. Driven by cases F1/F2/F3 in ``test_244_attachment_hydration.py``.

    ⚠ THE COST THIS ADDS, named rather than discovered later: hydration used to run
    ``ws_list_files`` ONCE PER SESSION and now runs it ONCE PER ``execute_code`` CALL. That is
    one bounded, thread-scoped DB listing on a handler that already awaits container I/O —
    accepted deliberately, because the alternative (an invalidation signal from the upload door
    into the dispatcher) is a SECOND mechanism that can go out of sync, and a marker that went
    out of sync with the container is exactly how this hole was made.

    ⚠ ONE EXPIRY GATE, TWO READERS (D-244-04). `ws_list_files` -> `list_files_in_thread` applies
    ``expires_at IS NULL OR expires_at > now()`` IN SQL, so WHICH files exist is decided there and
    nowhere else. `get_file_by_path` is used only to fetch the content columns the listing does
    not select, and it is deliberately UNFILTERED on expiry — which is exactly why it must never
    be the thing that decides membership.

    ⚠ The copy shape is `render_template`'s `_copy_in` (:3580-3601): NamedTemporaryFile ->
    `copy_to_runtime` -> unlink. ⛔ NOT the skill-file loop's base64-in-source preamble — that
    inflates the generated code file by 33% and would be catastrophic on a 10 MB attachment.

    ⚠ D-v2.5-01: every blocking call goes through `run_in_threadpool`.
    """
    import tempfile as _tempfile_local
    import os as _os_local

    notes: list[str] = []
    try:
        rows = await ws_list_files(ctx.pool, thread_id=UUID(ctx.thread_id))
    except Exception:
        logger.warning("attachment hydration: listing failed for thread %s", ctx.thread_id,
                       exc_info=True)
        return notes
    if not rows:
        return notes  # S-2: empty => do nothing at all. No mkdir, no note, no event.

    # ⭐ 244-10. Only the rows this session has not already received, and the filter is applied
    # to THE GATED LISTING'S OUTPUT — it adds no second expiry rule (D-244-04: `ws_list_files`'
    # SQL is the one home of `expires_at IS NULL OR expires_at > now()`).
    rows = [r for r in rows if (r.get("path") or "") not in already]
    if not rows:
        # ⛔ The STEADY STATE, and it is the common one: a run calling execute_code eight times
        # reaches here seven times. No mkdir, no copy, no note — the same nothing the
        # zero-attachment path costs, which Deep and Harness both share.
        return notes

    # ⛔ T-244-10-01 — THE CAP IS A SESSION TOTAL, NEVER A PER-CALL COUNT. Making the copy
    # incremental is exactly what would turn this into a per-call budget, letting a thread
    # exceed it by attaching across several calls — the DoS arm of T-244-02-05, re-opened by the
    # fix that closes defect 6b.
    if len(already) + len(rows) > _ATTACHMENT_HYDRATION_MAX_FILES:
        notes.append(
            f"Only the first {_ATTACHMENT_HYDRATION_MAX_FILES} of "
            f"{len(already) + len(rows)} workspace files were copied into "
            f"{_ATTACHMENTS_DIR}/. Read the rest with workspace_read."
        )
        rows = rows[:max(_ATTACHMENT_HYDRATION_MAX_FILES - len(already), 0)]
    if not rows:
        return notes  # budget exhausted — NAMED above, never silent.

    try:
        await run_in_threadpool(session.execute_command, f"mkdir -p {_ATTACHMENTS_DIR}")
    except Exception:
        logger.warning("attachment hydration: mkdir failed", exc_info=True)

    def _copy_in(local_bytes: bytes, container_path: str) -> None:
        with _tempfile_local.NamedTemporaryFile(mode="wb", delete=False) as _tmp:
            _tmp.write(local_bytes)
            _local = _tmp.name
        try:
            session.copy_to_runtime(_local, container_path)
        finally:
            try:
                _os_local.unlink(_local)
            except OSError:
                pass

    for row in rows:
        src_path = row.get("path") or ""
        dest = _attachment_container_path(src_path)
        try:
            file_row = await get_file_by_path(ctx.pool, UUID(ctx.thread_id), src_path)
            if file_row is None:
                raise WorkspaceError(f"row vanished between listing and read: {src_path}")
            content = await _get_file_content(ctx.pool, ctx.supabase, file_row)
            await run_in_threadpool(_copy_in, content, dest)
            # ⭐ 244-14 (WR-03) — RECORDED ON SUCCESS. `244-10` recorded it before the attempt,
            # which made ONE Supabase blip cost the file for the whole ~30-minute session, with
            # no note on any later call. `already` now means *"do not attempt this again"* and
            # is written by exactly two places: here, and the give-up arm below.
            already.add(src_path)
        except Exception as e:
            attempts = failed.get(src_path, 0) + 1
            failed[src_path] = attempts
            if attempts >= _ATTACHMENT_HYDRATION_MAX_ATTEMPTS:
                # ⛔ GIVEN UP ON, ONCE AND DELIBERATELY — this is the DoS bound `244-10`'s
                # deviation was protecting, kept but paid for with a CAP rather than with never
                # retrying. A genuinely broken row costs at most two attempts per session, not
                # one DB read plus one container write on every execute_code call for 30 minutes.
                already.add(src_path)
            logger.warning(
                "attachment hydration: %s failed (attempt %d/%d): %s",
                src_path, attempts, _ATTACHMENT_HYDRATION_MAX_ATTEMPTS, e, exc_info=True,
            )
            # ⛔ NAMED ON EVERY ATTEMPT, never once. T-244-02-07: a file the user attached is
            # never dropped silently, and the silence UAT L-5 measured was not the first note
            # going missing — it was every note AFTER it.
            notes.append(
                f"Could not load the attached file {os.path.basename(src_path)} into "
                f"{_ATTACHMENTS_DIR}/ ({type(e).__name__}). It is still readable with "
                f"workspace_read if it is a text file."
            )
    return notes


async def _handle_execute_code(args: dict, ctx: ToolContext) -> ToolResult:
    """Execute code in the sandbox container.

    This is the largest handler (~385 lines in threads.py). It manages the
    sandbox session lifecycle, queue drain loop, file harvesting, and all
    sandbox SSE events.
    """
    # Import drain_step from threads module (it's a pure function at module scope)
    from app.api.threads import drain_step  # noqa: PLC0415

    import uuid as _uuid_mod
    import tempfile as _tempfile_local
    import os as _os_local

    code = args.get("code", "")
    libraries = args.get("libraries") or []

    # Phase 142 (SRH-01 / D-06) — PRE-FLIGHT repeat-guard. If a PERMANENT runtime
    # gap already fired on a token THIS run and the incoming code references it
    # again, short-circuit BEFORE acquiring the sandbox. This structurally caps the
    # BUG-260707-02 soffice/markitdown retry loop at <=1 real dead sandbox call per
    # token, even for a weak model that ignores the honest framing. Guarded
    # `is not None` => a literal no-op for every unwired (Deep/harness/eval/test)
    # caller, so no sandbox event fires and Deep behavior stays byte-identical.
    # Tokens are drawn only from the fixed KNOWN_MISSING allowlist (or a narrowed
    # bundled-tree G-A path captured from stderr). CR-02: binary/module IDENTIFIERS
    # (`node`, `soffice`, `markitdown`) are matched at WORD BOUNDARIES and JS/path
    # tokens by containment via `_code_references_dead_token` — a bare substring
    # inside a larger word (`annotate`, `node_list`, `network_xyz`) never re-blocks
    # legitimate code for the rest of the run.
    if ctx.dead_gap_tokens_in_run is not None:
        _dead_token = next(
            (t for t in ctx.dead_gap_tokens_in_run
             if t and _code_references_dead_token(code, t)),
            None,
        )
        if _dead_token is not None:
            # WR-02: bracket the short-circuit with the SAME code_execution
            # start/complete SSE pair the normal path emits (:998 / :1335), so the
            # UI code-card for this call RESOLVES instead of spinning forever with
            # no matching complete event. Every other exit path from this handler
            # (timeout abort, exception) already emits a complete. Safe for unwired
            # callers — the whole block is gated on `dead_gap_tokens_in_run is not
            # None`, so Deep/eval/duck-typed ctx never reach it (byte-identical D-14).
            await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_start',
                           code_preview=code[:200])
            await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete',
                           exit_code=1, duration_ms=0, output_files=[])
            _short_circuit = _repeat_blocked_result(_dead_token)
            return ToolResult(result=_short_circuit, llm_content=_short_circuit)

    # Emit start event (SAND-04)
    await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_start', code_preview=code[:200])
    # SAND (silence fix): setup-window clock for the honest phase labels below
    # ('starting sandbox' / 'installing libraries'). Everything between here and
    # the drain loop (container bring-up + pip install) used to run blocking on
    # the event loop and emit NOTHING — the real dead-air the user perceived.
    _setup_started = time_mod.time()

    # Use the previous_files_in_run dict from ctx for cross-call file tracking
    _previous_files_in_run = ctx.previous_files_in_run if ctx.previous_files_in_run is not None else {}

    try:
        # SAND (silence fix): honest 'starting sandbox' phase for the container
        # spin-up window + threadpool the blocking create/attach so it never
        # freezes the event loop (D-v2.5-01). A NEW-thread container build is
        # 15-22s that used to be silent dead-air, also stalling SSE flush for
        # every run on the worker.
        await ctx.emit(ctx.redis, ctx.run_id, 'code_executing',
                       tool_index=ctx.tool_index,
                       elapsed_seconds=round(time_mod.time() - _setup_started, 1),
                       phase='starting_sandbox')
        session = await run_in_threadpool(sandbox_manager.get_or_create, ctx.thread_id)

        # Phase 120 (COLL-01) — run-scope the harvest by SEEDING the per-run
        # dedup baseline ONCE with a SHA-256 snapshot of every file already in
        # /sandbox/output/ at run start. This excludes any pre-existing file
        # (e.g. a prior workflow's leftover .docx) from this run's emitted
        # delta — the harvest's existing `if h in previous_files: continue`
        # dedup does the rest. D-120-01: per-RUN scope, NOT per-cell — guard so
        # a multi-cell run seeds only on the FIRST cell (the per-cell
        # accumulation `_previous_files_in_run.update(_iter_files)` below stays
        # unchanged). D-120-02: NO /sandbox/output/ clear — we only stop
        # re-emitting, never destroy files. D-v2.5-01: run_in_threadpool is
        # MANDATORY — the snapshot does blocking container I/O. The same handler
        # serves BOTH Deep and Harness, so this one seed site covers both.
        if not getattr(ctx, "_output_baseline_seeded", False):
            _baseline = await run_in_threadpool(snapshot_output_baseline, session)
            # 296-06 (BUG-261024-04 lead 2): `ctx` is rebuilt every agent-loop iteration, so this
            # re-seeds per iteration; a file THIS run already recorded keeps its meta (url,
            # iteration) instead of being overwritten as a pre-run `iteration: -1, url: None`.
            _previous_files_in_run.update(
                {h: m for h, m in _baseline.items() if h not in _previous_files_in_run}
            )
            ctx._output_baseline_seeded = True

        loop = asyncio.get_running_loop()
        sandbox_queue: asyncio.Queue = asyncio.Queue()

        # Phase 075 D-075-05/06: callbacks carry captured_at
        def on_stdout(chunk: str):
            loop.call_soon_threadsafe(
                sandbox_queue.put_nowait,
                {"type": "stdout_chunk", "content": chunk, "captured_at": time_mod.time()}
            )

        def on_stderr(chunk: str):
            loop.call_soon_threadsafe(
                sandbox_queue.put_nowait,
                {"type": "stderr_chunk", "content": chunk, "captured_at": time_mod.time()}
            )

        # Ensure /sandbox/output exists (threadpool — blocking container I/O, D-v2.5-01)
        try:
            await run_in_threadpool(session.execute_command, "mkdir -p /sandbox/output")
        except Exception:
            pass

        # Phase 244 (SHELL-04 / C-9) — hydrate this thread's attachments into
        # /sandbox/attachments/ so a binary attachment is USABLE, not merely present.
        #
        # ⛔ ONCE PER FILE PER SANDBOX SESSION — AND THE RECORD LIVES ON THE SESSION, WHICH IS
        # THE ONLY OBJECT THAT SURVIVES LONG ENOUGH TO MEAN IT (WR-02 / 244-07). It was on `ctx`
        # "in the exact shape of the `_output_baseline_seeded` guard", and that shape is wrong
        # for this claim: `agent_loop.py` constructs a **new ToolContext on every iteration**
        # (its own comment says so — *"Phase 083 D-01: construct ToolContext once per
        # iteration"*), so a fresh object meant a fresh `getattr` default and the guard only
        # ever suppressed re-copies among PARALLEL tool calls inside one iteration. Measured
        # cost of that: a run calling execute_code in eight iterations copied the same 10 MB
        # attachment eight times — the DoS arm of T-244-02-05, still open behind a comment
        # saying it was closed.
        #
        # ⭐ THE MARKER IS `_hydrated_files` (see its definition), AND ITS TYPE CHANGED AT 244-10
        # BECAUSE A BOOLEAN WAS THE DEFECT. A `WeakSet` of sessions said only THAT hydration had
        # run, so a file attached AFTER the sandbox existed was never copied — the session is
        # cached per `thread_id` until idle eviction, so "already hydrated" stayed true for the
        # whole 30 minutes while the container's contents were provably stale. The record now
        # says WHICH paths arrived, and the helper is consulted on EVERY call rather than once.
        # ⚠ `_output_baseline_seeded` above is left alone deliberately: it is a different claim
        # on a different cadence, and moving it is not this defect.
        # ⚠ ⛔ THIS COMMENT USED TO SAY *"Each path is recorded BEFORE its copy is attempted,
        # inside the helper: a hard failure must not re-attempt container I/O on every subsequent
        # execute_code call. Per-FILE failures are already handled and named individually there,
        # so nothing is lost by it."* — CORRECTED BY 244-14 (review WR-03), and kept rather than
        # overwritten because the second sentence was false and confident. Naming a failure in
        # the call it happened in is NOT naming it: every later call filtered the path out, so
        # the model heard nothing, and one transient Supabase blip cost the file for the whole
        # ~30-minute session. A path is now recorded on SUCCESS, or after
        # `_ATTACHMENT_HYDRATION_MAX_ATTEMPTS` failures — the DoS bound survives as a CAP.
        # ⛔ A thread with no NEW attachments performs no mkdir, no copy and adds no note — Deep
        # and Harness share this handler, so the steady state must cost exactly nothing.
        _already_copied, _failed_attempts = _session_hydration_records(session)
        _attachment_notes = await _hydrate_thread_attachments(
            ctx, session, _already_copied, _failed_attempts
        )

        # Inject skill files into sandbox
        skill_files_req = args.get("skill_files") or []
        file_preamble = ""
        # SEED-125 (CR-01): resolve the caller's org-gated skill-visibility filter ONCE
        # before the injection loop (not per file) so a disjoint-org caller cannot pull
        # another org's is_org_shared skill files into the sandbox on the service client.
        #
        # Phase 264 (PACK-17 / D-264-04) — ⭐ WIDEN. `execute_code` is advertised to Expert runs
        # like every other chat run (Phase 267 deleted the Expert tool filter, D-267-01).
        # Same class as `read_skill_file`, one layer further out, and the failure is QUIETER:
        # an unresolved skill here is a `logger.warning` plus a silently-skipped file below, so
        # the sandbox runs WITHOUT the helper and the model reasons on from a false premise.
        # ⚠ This handler applies no `is_enabled` filter either — see the born-for disjunct's
        # own enablement term (T-264-15). Resolved ONCE, before the loop, never per file.
        _sf_filter = (
            await _resolve_skill_visibility_or(ctx, born_for=True) if skill_files_req else None
        )
        for sf in skill_files_req:
            sf_skill_name = sf.get("skill_name", "")
            sf_filename = sf.get("filename", "")
            if not sf_skill_name or not sf_filename:
                continue
            _sf_resp = await aexec(
                ctx.supabase.table("skills")
                .select("id, user_id")
                .or_(_sf_filter)
                .eq("name", sf_skill_name)
                .maybe_single()
            )
            sf_skill = _sf_resp.data if _sf_resp is not None else None
            if not sf_skill:
                # Retry with normalized name
                _sf_norm = sf_skill_name.lower().replace(" ", "-")
                if _sf_norm != sf_skill_name:
                    _sf_resp2 = await aexec(
                        ctx.supabase.table("skills")
                        .select("id, user_id")
                        .or_(_sf_filter)
                        .eq("name", _sf_norm)
                        .maybe_single()
                    )
                    sf_skill = _sf_resp2.data if _sf_resp2 is not None else None
            if not sf_skill:
                logger.warning("Skill file injection: skill '%s' not found", sf_skill_name)
                continue
            sf_row = sf_skill[0] if isinstance(sf_skill, list) else sf_skill
            sf_storage_path = f"{sf_row['user_id']}/{sf_row['id']}/{sf_filename}"
            try:
                sf_bytes = ctx.supabase.storage.from_("skill-files").download(sf_storage_path)
                b64 = base64.b64encode(sf_bytes).decode("ascii")
                safe_name = sf_filename.replace("'", "\\'")
                file_preamble += (
                    f"import base64 as _b64, os as _os\n"
                    f"_os.makedirs('/sandbox', exist_ok=True)\n"
                    f"with open('/sandbox/{safe_name}', 'wb') as _f:\n"
                    f"    _f.write(_b64.b64decode('{b64}'))\n"
                    f"print('Injected skill file: {safe_name}')\n"
                )
            except Exception as sf_err:
                logger.warning("Failed to inject skill file %s/%s: %s", sf_skill_name, sf_filename, sf_err)

        wrapped_code = "import os; os.chdir('/sandbox/output')\n" + file_preamble + code

        # Write user code to a uniquely-named file inside the container
        code_file = f"/tmp/run-{_uuid_mod.uuid4().hex}.py"
        with _tempfile_local.NamedTemporaryFile(
            mode="w", encoding="utf-8", suffix=".py", delete=False
        ) as _tmp_fp:
            _tmp_fp.write(wrapped_code)
            _local_tmp_path = _tmp_fp.name
        try:
            await run_in_threadpool(session.copy_to_runtime, _local_tmp_path, code_file)
        finally:
            try:
                _os_local.unlink(_local_tmp_path)
            except OSError:
                pass

        # EXEC-01 (D-01/D-02.1): declared-install hardening + per-run heal bookkeeping.
        # `_declared_install_stderr` carries a persistent declared-install failure
        # forward to the honest tool result (never swallowed); `_healed_modules_fallback`
        # is the call-local heal bound used only when Redis is unavailable (graceful
        # degrade — a Redis hiccup must never break execute_code).
        _declared_install_stderr = ""
        _healed_modules_fallback: set[str] = set()

        # Install libraries
        if libraries:
            # SAND (silence fix): honest 'installing libraries' phase for the pip
            # window + threadpool the blocking install (matplotlib/pandas/etc.
            # can be many seconds) so it never freezes the event loop (D-v2.5-01).
            await ctx.emit(ctx.redis, ctx.run_id, 'code_executing',
                           tool_index=ctx.tool_index,
                           elapsed_seconds=round(time_mod.time() - _setup_started, 1),
                           phase='installing_libraries')
            # EXEC-01: `python -m pip install` (system interpreter → visible to the
            # `python -u` code run; non-stream → reliable exit_code), retry once. A
            # persistent failure surfaces via the honest tool result below — NEVER
            # silently swallowed as it was with the venv-targeted `session.install`.
            _declared_install_stderr = await _install_declared_libraries(
                session, libraries,
                thread_id=ctx.thread_id,
                timeout_s=settings.sandbox_exec_timeout_seconds,
            )

        start_time = time_mod.time()

        def _run_sync():
            exec_result = session.execute_command(
                f"python -u {code_file}",
                on_stdout=on_stdout,
                on_stderr=on_stderr,
            )
            loop.call_soon_threadsafe(
                sandbox_queue.put_nowait,
                {"type": "_done", "result": exec_result, "captured_at": time_mod.time()}
            )
            return exec_result

        fut = loop.run_in_executor(None, _run_sync)

        # Drain sandbox_queue, forwarding SSE events
        _drain_state: dict = {"stdout_partial": "", "stderr_partial": ""}
        _emitted_stdout_line_count = 0
        _emitted_stderr_line_count = 0
        _last_output_at = time_mod.time()
        _heartbeat_last = time_mod.time()
        _HEARTBEAT_INTERVAL_S = 1.0

        _tool_index = ctx.tool_index
        # 096 / SEED-063 — wall-clock ceiling for THIS execution. A runaway /
        # non-terminating script must not wedge the run forever (UAT Test 3).
        _exec_timeout_s = settings.sandbox_exec_timeout_seconds

        while True:
            try:
                item = await asyncio.wait_for(sandbox_queue.get(), timeout=_HEARTBEAT_INTERVAL_S)
            except asyncio.TimeoutError:
                now = time_mod.time()
                elapsed = now - start_time
                # ── 096 / SEED-063 wall-clock abort ─────────────────────────────
                # The _run_sync thread is blocked in session.execute_command and a
                # Python thread cannot be cancelled — kill+remove the container to
                # free it, surface the abort to the user + the model, and return a
                # tool-result error so the agent loop continues cleanly (never a
                # 40-minute zombie). 0/negative disables the cap (operator escape
                # hatch).
                if _exec_timeout_s > 0 and elapsed > _exec_timeout_s:
                    logger.warning(
                        "execute_code wall-clock timeout (%.0fs > %ds) thread=%s — "
                        "killing sandbox container", elapsed, _exec_timeout_s, ctx.thread_id,
                    )
                    try:
                        await run_in_threadpool(sandbox_manager.kill_session, ctx.thread_id)
                    except Exception:  # noqa: BLE001 — abort path never raises
                        logger.exception(
                            "kill_session failed after exec timeout thread=%s", ctx.thread_id,
                        )
                    # The blocked _run_sync thread will raise once the container is
                    # gone; we've abandoned `fut`. Retrieve its exception in a
                    # done-callback so Python doesn't log "exception never retrieved".
                    fut.add_done_callback(
                        lambda f: f.cancelled() or f.exception()
                    )
                    _msg = (
                        f"[execution aborted: exceeded the {_exec_timeout_s}s "
                        f"wall-clock limit]"
                    )
                    try:
                        await ctx.emit(ctx.redis, ctx.run_id, 'code_stderr',
                                       content=_msg, captured_at=now)
                        await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete',
                                       exit_code=124, error=_msg,
                                       duration_ms=int(elapsed * 1000), output_files=[])
                    except Exception:  # noqa: BLE001
                        logger.exception("exec-timeout SSE emit failed thread=%s", ctx.thread_id)
                    return ToolResult(result=json.dumps({
                        "status": "error",
                        "error": "execution_timeout",
                        "exit_code": 124,
                        "message": (
                            f"Code execution exceeded the {_exec_timeout_s}s wall-clock "
                            f"limit and was aborted. Reduce the input size, use a more "
                            f"efficient approach, or split the work into smaller steps."
                        ),
                        "elapsed_seconds": round(elapsed, 1),
                    }))
                if now - _last_output_at >= _HEARTBEAT_INTERVAL_S:
                    await ctx.emit(ctx.redis, ctx.run_id, 'code_executing',
                                   tool_index=_tool_index, elapsed_seconds=round(elapsed, 1),
                                   phase='running')
                if now - _heartbeat_last >= 10.0:
                    await ctx.emit(ctx.redis, ctx.run_id, 'keepalive')
                    _heartbeat_last = now
                continue

            if item["type"] == "_done":
                # Flush trailing partial lines
                if _drain_state["stdout_partial"]:
                    await ctx.emit(ctx.redis, ctx.run_id, "code_stdout",
                                   content=_drain_state["stdout_partial"],
                                   captured_at=time_mod.time())
                    _emitted_stdout_line_count += 1
                    _drain_state["stdout_partial"] = ""
                if _drain_state["stderr_partial"]:
                    await ctx.emit(ctx.redis, ctx.run_id, "code_stderr",
                                   content=_drain_state["stderr_partial"],
                                   captured_at=time_mod.time())
                    _emitted_stderr_line_count += 1
                    _drain_state["stderr_partial"] = ""
                # Post-completion safety-net
                _exec_result = item.get("result")
                if _exec_result is not None:
                    _final_stdout = (getattr(_exec_result, "stdout", "") or "").strip()
                    _final_stderr = (getattr(_exec_result, "stderr", "") or "").strip()
                    if _emitted_stdout_line_count == 0 and _final_stdout:
                        await ctx.emit(ctx.redis, ctx.run_id, "code_stdout",
                                       content=_final_stdout,
                                       captured_at=time_mod.time())
                    if _emitted_stderr_line_count == 0 and _final_stderr:
                        await ctx.emit(ctx.redis, ctx.run_id, "code_stderr",
                                       content=_final_stderr,
                                       captured_at=time_mod.time())
                break

            if item["type"] in ("stdout_chunk", "stderr_chunk"):
                _last_output_at = item["captured_at"]
                emit_calls, _drain_state = drain_step(item, _drain_state)
                for evt_type, content, captured_at in emit_calls:
                    await ctx.emit(ctx.redis, ctx.run_id, evt_type,
                                   content=content, captured_at=captured_at)
                    if evt_type == "code_stdout":
                        _emitted_stdout_line_count += 1
                    else:
                        _emitted_stderr_line_count += 1
            else:
                await ctx.emit(ctx.redis, ctx.run_id, item['type'],
                               **{k: v for k, v in item.items() if k != 'type'})

        exec_result = await fut
        end_time = time_mod.time()
        duration_ms = int((end_time - start_time) * 1000)

        # Derive actual exit code (Defect C: a bare `python -u` streams exit 0 even on a
        # traceback → bump to 1 on a stdout error marker).
        actual_exit_code = _derive_actual_exit_code(exec_result)

        # EXEC-01 (D-02.2 / D-03) — bounded, RUN-SCOPED ModuleNotFound auto-heal. On a
        # FAILED run, install the missing module (system interpreter) + re-run the code
        # ONCE, bounded 1-per-module-per-RUN via a per-run Redis key on ctx.run_id (with
        # a graceful call-local fallback). A successful heal adopts the re-run result and
        # flows through the normal DB-log / harvest / completion path below; a persistent
        # failure attaches an honest `install_failed` note to the MODEL-facing llm_content
        # (never a raw traceback under a 'completed' status). Provider-uniform, no
        # `provider ==` fork; a clean run never enters here (Deep byte-identical — D-04).
        _install_failed_note: "dict | None" = None
        # WR-02 (176): True once a heal RE-RUN produced a new result. The re-run runs
        # WITHOUT on_stdout/on_stderr, so its output never streamed as code_stdout/
        # code_stderr deltas — the live card still holds the FIRST run's pre-heal error
        # text. This flag drives the corrective stdout/stderr carried on the completion
        # event below so the live card reflects the run of record, not a stale error
        # under a success badge.
        _healed_rerun = False
        if actual_exit_code != 0:
            _heal = await _autoheal_missing_module(
                session=session, ctx=ctx, code_file=code_file,
                stdout=exec_result.stdout or "", stderr=exec_result.stderr or "",
                declared_install_stderr=_declared_install_stderr,
                healed_fallback=_healed_modules_fallback,
            )
            if _heal is not None:
                if _heal.get("exec_result") is not None:
                    exec_result = _heal["exec_result"]
                    duration_ms = int((time_mod.time() - start_time) * 1000)
                    actual_exit_code = _derive_actual_exit_code(exec_result)
                    _healed_rerun = True
                if _heal.get("install_failed") is not None:
                    _install_failed_note = _heal["install_failed"]

        # Log execution to DB (SAND-09)
        exec_row = await aexec(
            ctx.supabase.table("code_executions").insert({
                "thread_id": ctx.thread_id,
                "user_id": ctx.current_user["id"],
                "code": code,
                "exit_code": actual_exit_code,
                "duration_ms": duration_ms,
            })
        )
        execution_id = exec_row.data[0]["id"] if exec_row.data else None

        # Harvest output files from container
        output_file_list: list[dict] = []
        if execution_id and actual_exit_code == 0:
            delta_files, _iter_files = await run_in_threadpool(
                harvest_output_files,
                session, execution_id, ctx.current_user["id"], ctx.supabase,
                _previous_files_in_run,
                ctx.iteration,
            )
            # RUN-01a: content-hashes present THIS cell that weren't already tracked
            # are genuinely new to the run. Compute the set difference BEFORE the
            # .update() below so (a) baseline hashes seeded at ~929 (already in
            # _previous_files_in_run.keys() because the baseline seed runs earlier
            # in this same handler on the first cell) are excluded, and (b) cross-cell
            # regenerations (a hash already tracked from an earlier cell) are excluded —
            # matching the per-cell delta_files "not new" semantics. Guarded on the
            # None default so sub-agent/harness ctx builds stay byte-identical (D-14).
            if ctx.new_file_hashes_in_run is not None:
                ctx.new_file_hashes_in_run |= (set(_iter_files) - _previous_files_in_run.keys())
            _previous_files_in_run.update(_iter_files)
            output_file_list = delta_files

        # Emit completion event (SAND-06)
        _complete_kwargs: dict = dict(
            exit_code=actual_exit_code, duration_ms=duration_ms,
            execution_id=execution_id, output_files=output_file_list,
        )
        # WR-02 (176): on a heal re-run, carry the HEALED run's authoritative
        # stdout/stderr + a `healed` marker so the client REPLACES the stale pre-heal
        # delta text (which never got superseded — the re-run had no stream callbacks)
        # with the real output of record. Guarded on `_healed_rerun` → the normal
        # (non-heal) completion is byte-identical (D-14); a clean run never sets it.
        if _healed_rerun:
            _complete_kwargs["healed"] = True
            _complete_kwargs["stdout"] = exec_result.stdout or ""
            _complete_kwargs["stderr"] = exec_result.stderr or ""
        await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete', **_complete_kwargs)

        exec_status = "completed" if actual_exit_code == 0 else "error"
        tool_result = json.dumps({
            "status": exec_status,
            "exit_code": actual_exit_code,
            "duration_ms": duration_ms,
            "execution_id": execution_id,
            "output_files": output_file_list,
            "stdout": exec_result.stdout or "",
            "stderr": exec_result.stderr or "",
        })
        # Strip signed URLs from LLM context
        _llm_payload = {
            "status": exec_status,
            "exit_code": actual_exit_code,
            "duration_ms": duration_ms,
            "output_files": [{"filename": f["filename"], "size": f["size"]} for f in output_file_list],
            "stdout": exec_result.stdout or "",
            "stderr": exec_result.stderr or "",
        }
        # Phase 244 (T-244-02-07) — a file the user attached that could NOT be loaded is NAMED
        # to the model, never silently dropped. Guarded on a non-empty list, so a clean run (and
        # every zero-attachment run) carries no new key and stays byte-identical.
        if _attachment_notes:
            _llm_payload["attachments"] = _attachment_notes
        # 2026-08-19 — SELF-REPAIR for the single most expensive authoring mistake
        # observed: the model writes correct code that opens `/sandbox/<file>` but
        # omits the `skill_files` argument, so the file is never injected. The raw
        # error it gets back is `PackageNotFoundError` / `FileNotFoundError` naming a
        # path — which says nothing about the argument it forgot, so it cannot
        # self-correct. Measured: a local 20B model burned FOUR attempts and 26
        # minutes on exactly this; a frontier model read the tool schema and got it
        # right first try. Naming the missing argument turns a dead end into one
        # retry. Fires ONLY on a failing run that referenced an un-injected
        # /sandbox path, so a correct call is byte-identical.
        import re as _re_hint   # module-local idiom (see _handle_load_skill)
        _stderr_txt = exec_result.stderr or ""
        if actual_exit_code != 0 or "Traceback" in _stderr_txt:
            _injected = {
                (sf.get("filename") or "") for sf in (skill_files_req or [])
            }
            _referenced = set(_re_hint.findall(r"/sandbox/([A-Za-z0-9._-]+)", _stderr_txt))
            # /sandbox/output/<name> is the OUTPUT dir, never an injected input.
            _missing = {f for f in _referenced if f and f != "output" and f not in _injected}
            if _missing:
                _names = ", ".join(sorted(_missing))
                _llm_payload["missing_skill_file"] = (
                    f"The code referenced /sandbox/{_names} but that file was NOT injected "
                    f"into the sandbox, because this execute_code call did not pass a "
                    f"`skill_files` argument for it. Retry the SAME call with "
                    f'`skill_files: [{{"skill_name": "<skill name as returned by '
                    f'load_skill>", "filename": "{sorted(_missing)[0]}"}}]` added. '
                    f"Do not change the code."
                )
                logger.info(
                    "execute_code: missing_skill_file hint emitted for %s (injected=%s)",
                    _names, sorted(_injected),
                )

        # Phase 142 (SRH-01 / D-06) — POST-HOC reshape. Classify the completed
        # failure against the fixed KNOWN_MISSING allowlist; on a HIT append a
        # PERMANENT-framed `runtime_gap` note to the MODEL-facing llm_content (so a
        # weak model can't misread a bare stderr as transient) AND record the token
        # in the run-scoped repeat-guard set (guarded `is not None` => no-op when
        # unwired). On a MISS (T-142-01) stdout/stderr pass through UNCHANGED — a
        # real error still reaches the model. `tool_result` (the persisted/UI copy)
        # is left untouched: only the model-facing view carries the honest note.
        # CR-01(1a): classify ONLY an actual FAILURE. A successful exit-0 run is
        # NEVER reshaped and NEVER records a repeat-guard token — even if its stdout
        # happens to print a string like "node not found". All three real gap
        # classes always exit non-zero (or get bumped to 1 above when an exit-0 run
        # prints a Python error marker to stdout), so gating on failure loses no
        # true positive while removing the successful-run false-reshape path.
        _gap = None
        if actual_exit_code != 0:
            _gap = _classify_runtime_gap(
                code, exec_result.stdout or "", exec_result.stderr or "", actual_exit_code
            )
        if _gap is not None:
            _llm_payload["runtime_gap"] = _gap
            if ctx.dead_gap_tokens_in_run is not None:
                ctx.dead_gap_tokens_in_run.add(_gap["token"])
        # EXEC-01 (D-03) — honest install-failure note on the MODEL-facing llm_content
        # only (the persisted/UI `tool_result` stays a normal error). Mirrors the
        # runtime_gap injection above; only set on a FAILED run, so `status` is already
        # "error". Mutually exclusive with runtime_gap (KNOWN_MISSING modules are never
        # healed, unknown modules are never classified as a permanent gap).
        if _install_failed_note is not None:
            _llm_payload["install_failed"] = _install_failed_note
        llm_content = json.dumps(_llm_payload)
        ctx.spawn(write_audit_entry(
            user_id=ctx.current_user["id"],
            action_type="code.execute",
            metadata={"thread_id": ctx.thread_id, "language": args.get("language", "python")},
            supabase=ctx.supabase,
        ))

        return ToolResult(result=tool_result, llm_content=llm_content)

    except Exception as exec_err:
        logger.error("execute_code failed: %s", exec_err)
        await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete',
                       exit_code=1, error=str(exec_err), duration_ms=0, output_files=[])
        return ToolResult(result=json.dumps({"status": "error", "error": str(exec_err)}))


# ---------------------------------------------------------------------------
# EXEC-01 (Phase 176-03 / D-02.2 / D-03) — run-scoped ModuleNotFound auto-heal.
# Reuses `_NO_MODULE_RE` for extraction and `_pip_install` (system interpreter) for
# the install; the 1-per-module-per-RUN bound lives in a per-run Redis SET keyed on
# `ctx.run_id` (`heal_attempted:{run_id}`, SADD/SISMEMBER + EXPIRE 600 — same run-buffer
# TTL discipline as `run:{run_id}` / eval_runner_service / skill_tuner) with a graceful
# call-local fallback when Redis is unavailable. Entirely below the provider boundary
# → provider-uniform, and a literal no-op for any run where the code succeeds (a clean
# run never enters the heal), so Deep behavior stays byte-identical (D-04/D-14).
# ---------------------------------------------------------------------------
_PREINSTALLED_HINT_LIBS = (
    "reportlab, pandas, matplotlib, python-docx, python-pptx, openpyxl, "
    "docxtpl, numpy, scipy, seaborn, plotly, pypdf"
)
_HEAL_BOUND_TTL_S = 600  # run-buffer TTL (eval_runner_service:79 / skill_tuner:114)


def _extract_missing_module(stdout: str, stderr: str) -> "str | None":
    """Extract the missing module from a ModuleNotFoundError via the shared
    `_NO_MODULE_RE`, scanning stdout+stderr lowercased (mirrors `_classify_runtime_gap`
    `out_l`). None when there is no `No module named 'X'` signal."""
    out_l = f"{stdout or ''}\n{stderr or ''}".lower()
    m = _NO_MODULE_RE.search(out_l)
    return m.group(1) if m else None


def _install_failed_detail(module: str, reason: str) -> dict:
    """Model-facing honest payload for a persistent install/heal failure. The reason
    (pip stderr) is truncated ~300 chars; the hint points at the preinstalled set so
    the model can pivot instead of blindly retrying (D-03)."""
    return {
        "module": module,
        "reason": (reason or "").strip()[:300],
        "hint": (
            f"Could not install {module}. Use a preinstalled library "
            f"({_PREINSTALLED_HINT_LIBS}) or tell the user this package is "
            "unavailable. Do not retry the same install."
        ),
    }


async def _heal_bound_seen(ctx, healed_fallback: set, module: str) -> bool:
    """True if `module` was already heal-attempted anywhere in THIS run. Consults the
    per-run Redis set (`heal_attempted:{ctx.run_id}`); on ANY Redis error/unavailability
    falls back to the call-local set. `ctx.redis` is a redis.asyncio client so sismember
    is awaited directly (NO run_in_threadpool — that wraps only the blocking sandbox
    session.* calls; D-v2.5-01)."""
    redis = getattr(ctx, "redis", None)
    run_id = getattr(ctx, "run_id", None)
    if redis is not None and run_id is not None:
        try:
            return bool(await redis.sismember(f"heal_attempted:{run_id}", module))
        except Exception as _e:  # noqa: BLE001 — a Redis hiccup must never break execute_code
            logger.warning("heal-bound sismember failed (call-local fallback): %s", _e)
    return module in healed_fallback


async def _heal_bound_record(ctx, healed_fallback: set, module: str) -> None:
    """Record `module` as heal-attempted for THIS run in the per-run Redis set (SADD +
    EXPIRE so it self-expires with the run buffer); falls back to the call-local set on
    any Redis error/unavailability."""
    redis = getattr(ctx, "redis", None)
    run_id = getattr(ctx, "run_id", None)
    if redis is not None and run_id is not None:
        try:
            key = f"heal_attempted:{run_id}"
            await redis.sadd(key, module)
            await redis.expire(key, _HEAL_BOUND_TTL_S)
            return
        except Exception as _e:  # noqa: BLE001 — degrade gracefully
            logger.warning("heal-bound sadd failed (call-local fallback): %s", _e)
    healed_fallback.add(module)


async def _autoheal_missing_module(
    *, session, ctx, code_file: str, stdout: str, stderr: str,
    declared_install_stderr: str, healed_fallback: set,
) -> "dict | None":
    """Bounded ModuleNotFound auto-heal for a FAILED execute_code run (D-02.2 / D-03).

    Returns one of:
      * ``None`` — nothing to heal (no ModuleNotFound + no declared failure, or a
        KNOWN_MISSING permanent gap → left to ``_classify_runtime_gap``).
      * ``{"install_failed": {...}}`` — honest note for ``llm_content`` (no re-run).
      * ``{"exec_result": <ConsoleOutput>}`` — the code was re-run clean; adopt it.
      * ``{"exec_result": <ConsoleOutput>, "install_failed": {...}}`` — re-ran but still
        missing → adopt the new result AND attach the honest note.
    """
    module = _extract_missing_module(stdout, stderr)
    if module is None:
        # No ModuleNotFound signal — but a persistent DECLARED install failure must
        # still surface honestly rather than be swallowed (D-01).
        if declared_install_stderr:
            return {"install_failed": _install_failed_detail(
                "the declared libraries", declared_install_stderr)}
        return None

    # KNOWN_MISSING permanent gaps (e.g. markitdown) are reshaped by _classify_runtime_gap
    # — never install/heal them here.
    if module in KNOWN_MISSING_MODULES:
        return None

    # Run-scoped 1-per-module bound: a module already heal-attempted anywhere in this
    # run (INCLUDING a prior execute_code call — the actual BUG-260708-02 behavior, which
    # a call-local set cannot bound) goes straight to the honest result, no re-install.
    if await _heal_bound_seen(ctx, healed_fallback, module):
        return {"install_failed": _install_failed_detail(
            module, declared_install_stderr or "Already attempted to install this module "
            "earlier in this run; it did not resolve.")}

    await _heal_bound_record(ctx, healed_fallback, module)

    # CR-01 (176): both the heal install and the re-run are bounded by the SAME
    # wall-clock ceiling the primary run uses (096/SEED-063) so a healed-then-runaway
    # script — or a hung `pip install` — can never wedge the run into a 40-minute
    # zombie. `thread_id` is what `_run_bounded_sandbox`/`kill_session` need to free
    # the container on overrun; absent (unit ctx) → no bound.
    _thread_id = getattr(ctx, "thread_id", None)
    _exec_timeout_s = settings.sandbox_exec_timeout_seconds

    # Install the missing module into the SYSTEM interpreter (python -m pip, retry once).
    _install_stderr = await _install_declared_libraries(
        session, [module], thread_id=_thread_id, timeout_s=_exec_timeout_s)
    if _install_stderr:
        return {"install_failed": _install_failed_detail(module, _install_stderr)}

    # Install OK — re-run the code ONCE, bounded by the wall-clock ceiling (a blocking
    # session.execute_command in a threadpool thread cannot be cancelled — D-v2.5-01),
    # reusing the container-resident code_file. Do NOT re-enter the async drain
    # (Pitfall 1). On overrun `_run_bounded_sandbox` has already killed the container;
    # surface an honest aborted note (never a silent zombie), mirroring the primary
    # run's `[execution aborted]` / 124 completion.
    try:
        new_result = await _run_bounded_sandbox(
            session.execute_command, f"python -u {code_file}",
            thread_id=_thread_id, timeout_s=_exec_timeout_s)
    except _SandboxCommandTimeout as _t:
        logger.warning(
            "auto-heal re-run wall-clock timeout (%ss) thread=%s module=%s — "
            "container killed", _t.timeout_s, _thread_id, module,
        )
        return {"install_failed": _install_failed_detail(
            module,
            f"installed, but the re-run exceeded the {_t.timeout_s}s wall-clock "
            "execution limit and was aborted.",
        )}
    still_missing = _extract_missing_module(
        getattr(new_result, "stdout", "") or "", getattr(new_result, "stderr", "") or ""
    )
    if still_missing is not None:
        return {"exec_result": new_result,
                "install_failed": _install_failed_detail(still_missing, "")}
    return {"exec_result": new_result}
