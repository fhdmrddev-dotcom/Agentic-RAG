"""Phase 101 template fill: the in-sandbox render driver source (``_RENDER_DRIVER_SRC``), the
101-06 CR-01 output-filename guard, and the ``render_template`` handler.

Moved VERBATIM out of ``tool_dispatcher.py`` in Phase 278 (SEAM-03, a pure move): every binding
here is AST-identical to its PHASE_BASE source, proven by ``tests/unit/test_278_pure_move.py``.
``tool_dispatcher.py`` keeps the registry: it imports the handlers below BY NAME into its static
``_TOOL_REGISTRY`` literal (Extension Contract — never registered dynamically).

⚠ PATCH-WHERE-USED: the bodies in this module resolve these names from THIS module's globals —
``run_in_threadpool``, ``sandbox_manager``, ``settings``, ``ws_write_file``, ``WorkspaceError``.
Patch ``app.services.tools.render_template.<name>``; a patch of the same name on
``tool_dispatcher`` no longer reaches the code that calls it (and, because the registry module no
longer imports them, raises ``AttributeError`` instead of silently patching nothing).

⚠ ``harness/emitters.py`` lazily imports ``_handle_render_template`` FROM ``tool_dispatcher``
(the registry binds it there by name), so the emitter tests keep patching
``tool_dispatcher._handle_render_template`` — that patch still reaches the emitter path.

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). Cross-family helpers are imported BY NAME from their
``app.services.tools.<family>`` home, never through the dispatcher.
"""
from __future__ import annotations

import logging
from uuid import UUID
import re as _re_filename

from starlette.concurrency import run_in_threadpool

from app.services.sandbox_service import sandbox_manager
from app.config import settings
from app.services.workspace_service import write_file as ws_write_file, WorkspaceError
from app.services.tools.base import ToolContext, ToolResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Phase 101 (TMPL-02 / TMPL-03) — render_template tool
#
# The G-5 extension contract: a new agent tool is a handler + ONE _TOOL_REGISTRY
# line; threads.py is never touched. This composes Plan 02's deterministic core
# (template_render_service) + Plan 03's byte resolution (template_asset_service)
# + the existing sandbox substrate (sandbox_service) + the existing workspace
# persist (workspace_service / workspace_file_written SSE) into a single handler.
#
# Pitfall 4 (the security boundary): the render functions run INSIDE the sealed,
# network-less Docker sandbox. The LLM produces DATA (the cited field-map, the
# tool's typed argument); deterministic code in the sandbox produces the FILE.
# There is NO docxtpl import in backend/app/** — the render driver below is a
# self-contained Python SOURCE STRING shipped into the container via
# copy_to_runtime and run by `python -u`, exactly like _handle_execute_code
# ships the user-code file.
# ---------------------------------------------------------------------------

# The render driver — a SELF-CONTAINED script shipped INTO the sandbox container.
#
# It imports ONLY libraries present in the sandbox image (docxtpl / python-docx /
# python-pptx / openpyxl / jinja2). It must NOT import `app.*` (the container has
# no backend/app on its path). It INLINES the small set of Plan-02 pure functions
# it needs (build_context / render_docx_template / run_replace_docx /
# residual_tags_in / assert_integrity), so the driver is dependency-free w.r.t.
# the backend package. It NEVER crashes — every exit path prints exactly ONE JSON
# verdict line as its FINAL stdout so the handler can parse the verdict back.
_RENDER_DRIVER_SRC = r'''
"""Phase 101 sandbox render driver (shipped INTO the container by tool_dispatcher).

argv: <engine> <template_path> <field_map_json_path> <out_path>
  engine: "docxtpl" (trusted/library, Jinja row-growth) | "run_replace"
          (arbitrary upload, non-Jinja scalar replace) | "acroform" (Phase 291: a fillable
          PDF, each answer written into its own field by name, validated, read back).

Prints exactly ONE JSON line as the LAST stdout line:
  {"rendered":bool, "opened":bool, "residual_clean":bool, "residual_tags":[...],
   "documented_limit":str|None, "rows":int, "error":str|None}
The handler treats a missing / non-`opened` verdict as a FAILURE (never persists).
"""
import json
import os
import re
import sys

_PLACEHOLDER_TOKEN_RE = re.compile(r"\{\{\s*[A-Za-z_][\w.]*\s*\}\}")
_RESIDUAL_TOKENS = ("{{", "}}", "{%", "%}")


def _cell(cited):
    cited = cited or {}
    v = cited.get("value") if isinstance(cited, dict) else None
    return {
        "value": "" if v is None else v,
        "source_chunk_id": cited.get("source_chunk_id") if isinstance(cited, dict) else None,
        "source_doc": cited.get("source_doc") if isinstance(cited, dict) else None,
        "source_page": cited.get("source_page") if isinstance(cited, dict) else None,
    }


def _build_row(row):
    row = row or {}
    r = {col: _cell(cited) for col, cited in row.items()}
    r.setdefault("score", "")
    return r


def build_context(field_map_dict):
    ctx = {}
    scalars = field_map_dict.get("scalars")
    collections = field_map_dict.get("collections")
    if scalars is not None or collections is not None:
        for key, cited in (scalars or {}).items():
            ctx[key] = _cell(cited)
        for cname, rows in (collections or {}).items():
            ctx[cname] = [_build_row(row) for row in (rows or [])]
        return ctx
    for key, val in field_map_dict.items():
        if isinstance(val, list):
            ctx[key] = [_build_row(row) for row in val]
        else:
            ctx[key] = _cell(val)
    return ctx


def _flat_scalars(field_map_dict):
    """Flatten a field-map into {token_key: str_value} for the run-replace engine.

    Accepts the generic envelope (scalars bucket) OR a flat {key: cited} dict.
    """
    src = field_map_dict.get("scalars")
    if src is None and field_map_dict.get("collections") is None:
        src = field_map_dict  # flat shape
    flat = {}
    for key, raw in (src or {}).items():
        if isinstance(raw, dict):
            v = raw.get("value")
        else:
            v = raw
        flat[key] = "" if v is None else str(v)
    return flat


def render_docx_template(template_path, context, out_path):
    from docxtpl import DocxTemplate
    from jinja2 import TemplateSyntaxError
    from jinja2.sandbox import SandboxedEnvironment

    doc = DocxTemplate(template_path)
    jenv = SandboxedEnvironment(autoescape=True)  # SSTI containment + XML-safe (&<>)
    try:
        doc.render(context, jinja_env=jenv)  # docxtpl owns the bytes; the LLM never does
    except TemplateSyntaxError as exc:
        return {"rendered": False, "error": "TemplateSyntaxError: %s" % exc}
    doc.save(out_path)
    return {"rendered": True, "error": None}


def _replace_in_paragraph(paragraph, flat_scalars):
    # 101-06 WR-04 / IR-01: this is a VERBATIM mirror of the audited production helper
    # (template_render_service._replace_in_paragraph) so the two copies cannot diverge.
    # The OLD driver guard `if blanked_text == full: return` compared the BLANKED text to
    # the ORIGINAL — so a matched token whose net text equals the original was SKIPPED and
    # the token could survive in a later run fragment (a silent non-fill WR-03 then shipped).
    # Production tracks `matched` and uses `touched = matched or (blanked_text != replaced_text)`.
    runs = paragraph.runs
    if not runs:
        return
    full = paragraph.text
    matched = set()
    replaced_text = full
    for key, value in flat_scalars.items():
        token = "{{" + key + "}}"
        if token in replaced_text:
            matched.add(key)
            replaced_text = replaced_text.replace(token, value)
    # Blank any remaining placeholder-shaped token (unmatched intended placeholders).
    blanked_text = _PLACEHOLDER_TOKEN_RE.sub("", replaced_text)
    touched = matched or (blanked_text != replaced_text)
    replaced_text = blanked_text
    if not touched:
        return  # no token here -> leave runs (and their formatting) intact
    # Coalesce: whole replaced text into run[0], clear the rest.
    runs[0].text = replaced_text
    for r in runs[1:]:
        r.text = ""


def run_replace_docx(template_path, flat_scalars, out_path):
    from docx import Document

    doc = Document(template_path)

    def _walk(paragraphs):
        for p in paragraphs:
            _replace_in_paragraph(p, flat_scalars)

    _walk(doc.paragraphs)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                _walk(cell.paragraphs)
    for section in doc.sections:
        _walk(section.header.paragraphs)
        _walk(section.footer.paragraphs)
    doc.save(out_path)
    return {"rendered": True, "error": None}


# ── Phase 291 (D-25 / D-29): the "acroform" engine — fill a fillable PDF by field name ──
# _read_acroform is an INLINED copy of describe_files.read_acroform_fields (the sandbox has no
# backend package on its path). test_291_acroform_reader_parity.py pins the two together.
_FF_RADIO = 1 << 15
_FF_PUSHBUTTON = 1 << 16
_CHECKBOX_TRUE = {"yes", "y", "true", "x", "checked", "on", "1"}
_CHECKBOX_FALSE = {"no", "n", "false", "unchecked", "off", "0", ""}
_NON_LATIN_LIMIT = (
    "Some answers use characters this form's font cannot show; viewers that redraw fields "
    "will show them."
)
# out_path -> the fill result, read by residual_tags_in / assert_integrity for fmt "pdf".
_FILL_RESULTS = {}


def _acro_str(v):
    return str(v) if v is not None else ""


def _acro_opt_values(opt):
    out = []
    for item in opt or []:
        try:
            item = item.get_object() if hasattr(item, "get_object") else item
        except Exception:
            continue
        if isinstance(item, (list, tuple)) and item:
            out.append(_acro_str(item[0]))
        else:
            out.append(_acro_str(item))
    return out


def _acro_ap_states(widget):
    try:
        ap = widget.get("/AP")
        ap = ap.get_object() if ap is not None else None
        n = ap.get("/N") if ap is not None else None
        n = n.get_object() if n is not None else None
        if hasattr(n, "keys"):
            return [str(k) for k in n.keys()]
    except Exception:
        pass
    return []


def _read_acroform(path):
    """Every terminal AcroForm field in document order as a dict: name, field_type, states,
    options, tooltip, value (/V) and widget_as (each widget's /AS). [] when none."""
    from pypdf import PdfReader

    reader = PdfReader(path)
    root = reader.trailer["/Root"].get_object()
    acro = root.get("/AcroForm")
    if acro is None:
        return []
    acro = acro.get_object()
    top = acro.get("/Fields")
    top = top.get_object() if top is not None else None
    if not top:
        return []
    out = []
    seen = set()

    def _walk(ref, prefix, inherited, depth):
        if depth > 32:
            return
        idnum = getattr(ref, "idnum", None)
        if idnum is not None:
            if idnum in seen:
                return
            seen.add(idnum)
        node = ref.get_object()
        t = node.get("/T")
        name = (("%s.%s" % (prefix, t)) if prefix else _acro_str(t)) if t is not None else prefix
        inh = {
            "ft": node.get("/FT", inherited.get("ft")),
            "ff": node.get("/Ff", inherited.get("ff")),
            "opt": node.get("/Opt", inherited.get("opt")),
        }
        kids = node.get("/Kids")
        kids = list(kids.get_object()) if kids is not None else []
        field_kids = [k for k in kids if "/T" in k.get_object()]
        if field_kids:
            for k in field_kids:
                _walk(k, name, inh, depth + 1)
            return
        if not name or inh["ft"] is None:
            return
        widgets = [k.get_object() for k in kids] if kids else [node]
        ft = str(inh["ft"])
        ff = int(inh["ff"] or 0)
        if ft == "/Tx":
            ftype = "text"
        elif ft == "/Ch":
            ftype = "choice"
        elif ft == "/Btn":
            if ff & _FF_PUSHBUTTON:
                return
            ftype = "radio" if ff & _FF_RADIO else "checkbox"
        else:
            return
        states = []
        if ftype in ("checkbox", "radio"):
            for w in widgets:
                for s in _acro_ap_states(w):
                    if s not in states:
                        states.append(s)
            if ftype == "radio":
                states = [s for s in states if s != "/Off"]
            elif "/Off" not in states:
                states.insert(0, "/Off")
        options = _acro_opt_values(inh["opt"]) if ftype == "choice" else []
        tu = node.get("/TU")
        v = node.get("/V")
        out.append({
            "name": name,
            "field_type": ftype,
            "states": states,
            "options": options,
            "tooltip": (_acro_str(tu).strip() or None) if tu is not None else None,
            "value": None if v is None else _acro_str(v),
            "widget_as": [_acro_str(w.get("/AS")) for w in widgets if w.get("/AS") is not None],
        })

    for ref in top:
        _walk(ref, "", {}, 0)
    return out


def _match_choice(value, field):
    """The field's OWN spelling for ``value`` (trimmed, case-insensitive), or None."""
    v = str(value).strip().casefold()
    if field["field_type"] in ("checkbox", "radio"):
        bare = v[1:] if v.startswith("/") else v
        for s in field["states"]:
            if s == "/Off":
                continue
            if s.lstrip("/").casefold() == bare:
                return s
        return None
    for opt in field["options"]:
        if opt.strip().casefold() == v:
            return opt
    return None


def _refused_sentence(field):
    label = field.get("tooltip") or field["name"]
    return "The answer for “%s” isn't one of this form's choices, so it was left blank." % label


def _write_values(writer, values):
    writer.update_page_form_field_values(None, values, auto_regenerate=False)


def fill_acroform(template_path, flat_values, out_path):
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject

    fields = _read_acroform(template_path)
    if not fields:
        # A flat PDF handed back unchanged would be a blank form passed off as filled (D-29).
        return {
            "rendered": False,
            "error": "This PDF has no fillable fields, so none of the answers could be written into it.",
            "refused": [],
            "readback_mismatch": [],
            "non_latin": False,
        }
    by_name = {f["name"]: f for f in fields}
    values = {}
    refused = []
    for key, raw in (flat_values or {}).items():
        field = by_name.get(key)
        if field is None:
            continue
        text = "" if raw is None else str(raw)
        ftype = field["field_type"]
        if ftype == "text":
            if text == "":
                continue
            values[key] = text
            continue
        if ftype == "checkbox":
            word = text.strip().casefold()
            on = next((s for s in field["states"] if s != "/Off"), None)
            if word in _CHECKBOX_FALSE:
                values[key] = "/Off"
                continue
            matched = _match_choice(text, field)
            if matched is None and word in _CHECKBOX_TRUE:
                matched = on
            if matched is None:
                refused.append({"field": key, "sentence": _refused_sentence(field)})
                continue
            values[key] = matched
            continue
        # radio / choice: empty means no answer; anything else must be one of the field's own.
        if text.strip() == "":
            continue
        matched = _match_choice(text, field)
        if matched is None:
            refused.append({"field": key, "sentence": _refused_sentence(field)})
            continue
        values[key] = matched

    writer = PdfWriter(clone_from=PdfReader(template_path))
    if values:
        _write_values(writer, values)
    writer.set_need_appearances_writer(True)
    acro = writer._root_object.get("/AcroForm")
    if acro is not None:
        acro = acro.get_object()
        if "/XFA" in acro:
            del acro[NameObject("/XFA")]
    with open(out_path, "wb") as fh:
        writer.write(fh)

    # D-29: read back every written value (/V, and /AS on every button widget).
    back = {f["name"]: f for f in _read_acroform(out_path)}
    mismatch = []
    for key, want in values.items():
        got = back.get(key)
        if got is None:
            mismatch.append(key)
            continue
        if got["field_type"] in ("checkbox", "radio"):
            ases = got["widget_as"]
            if want == "/Off":
                ok = (got["value"] in (None, "/Off")) and all(a == "/Off" for a in ases)
            else:
                ok = got["value"] == want and want in ases
        else:
            ok = got["value"] == want
        if not ok:
            mismatch.append(key)

    non_latin = any(
        by_name[k]["field_type"] in ("text", "choice") and any(ord(ch) > 255 for ch in v)
        for k, v in values.items()
    )
    result = {
        "rendered": True,
        "error": None,
        "refused": refused,
        "readback_mismatch": mismatch,
        "non_latin": non_latin,
    }
    _FILL_RESULTS[out_path] = result
    return result


def _pdf_documented_limit(fill):
    parts = []
    refused = fill.get("refused") or []
    if refused:
        n = len(refused)
        head = (
            "1 answer wasn't one of the form's choices and was left blank: "
            if n == 1
            else "%d answers weren't one of the form's choices and were left blank: " % n
        )
        parts.append(head + " ".join(r["sentence"] for r in refused))
    if fill.get("non_latin"):
        parts.append(_NON_LATIN_LIMIT)
    return " ".join(parts) or None


def _hits(texts):
    out = []
    for txt in texts:
        if txt and any(tok in txt for tok in _RESIDUAL_TOKENS):
            out.append(txt.strip()[:80])
    return out


def residual_tags_in(out_path, fmt):
    fmt = fmt.lower()
    if fmt == "docx":
        from docx import Document

        doc = Document(out_path)
        texts = [p.text for p in doc.paragraphs]
        for t in doc.tables:
            for row in t.rows:
                for cell in row.cells:
                    texts.append(cell.text)
        return _hits(texts)
    if fmt == "pptx":
        from pptx import Presentation

        prs = Presentation(out_path)
        texts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        for run in para.runs:
                            texts.append(run.text)
                if shape.has_table:
                    for row in shape.table.rows:
                        for cell in row.cells:
                            texts.append(cell.text)
        return _hits(texts)
    if fmt == "xlsx":
        from openpyxl import load_workbook

        wb = load_workbook(out_path)
        texts = []
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                for val in row:
                    if isinstance(val, str):
                        texts.append(val)
        return _hits(texts)
    if fmt == "pdf":
        # A PDF form has no {{ }} markup: what stays unfilled is each REFUSED field, by name.
        return [r["field"] for r in (_FILL_RESULTS.get(out_path) or {}).get("refused") or []]
    raise ValueError("residual_tags_in: unsupported fmt %r" % fmt)


def assert_integrity(out_path, fmt):
    """Re-open the produced file with the SAME library — the corruption oracle.

    Each loader RAISES on a corrupt/unopenable file; the caller catches it and
    sets opened=False so the file is NEVER delivered.
    """
    fmt = fmt.lower()
    residuals = residual_tags_in(out_path, fmt)
    documented_limit = None
    rows = 0
    if fmt == "docx":
        from docx import Document

        doc = Document(out_path)  # raises if corrupt / won't open
        rows = sum(len(t.rows) for t in doc.tables)
    elif fmt == "pptx":
        from pptx import Presentation

        prs = Presentation(out_path)  # raises if corrupt / won't open
        has_table = any(
            getattr(shape, "has_table", False)
            for slide in prs.slides for shape in slide.shapes
        )
        if has_table:
            documented_limit = "pptx cannot grow tables (python-pptx >=1.0.0)"
    elif fmt == "xlsx":
        from openpyxl import load_workbook

        wb = load_workbook(out_path)  # raises if corrupt / won't open
        has_chart = any(getattr(ws, "_charts", None) for ws in wb.worksheets)
        if has_chart:
            documented_limit = "openpyxl drops charts on save"
    elif fmt == "pdf":
        from pypdf import PdfReader

        PdfReader(out_path).trailer["/Root"]  # raises if corrupt / won't open
        fill = _FILL_RESULTS.get(out_path) or {}
        mismatch = fill.get("readback_mismatch") or []
        # A refused answer is a DOCUMENTED blank (golden-run safe), never a residual failure.
        return {
            "opened": not mismatch,
            "rows": 0,
            "residual_tags": residuals,
            "residual_clean": True,
            "documented_limit": _pdf_documented_limit(fill),
            "refused": fill.get("refused") or [],
            "error": (
                "The filled form did not read back as written for: %s. It was not delivered."
                % ", ".join(mismatch)
            ) if mismatch else None,
        }
    else:
        raise ValueError("assert_integrity: unsupported fmt %r" % fmt)
    return {
        "opened": True,
        "rows": rows,
        "residual_tags": residuals,
        "residual_clean": len(residuals) == 0,
        "documented_limit": documented_limit,
    }


def _fmt_from_path(path):
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    return ext or "docx"


def main():
    engine = sys.argv[1]
    template_path = sys.argv[2]
    field_map_json_path = sys.argv[3]
    out_path = sys.argv[4]
    fmt = _fmt_from_path(out_path)

    verdict = {
        "rendered": False,
        "opened": False,
        "residual_clean": False,
        "residual_tags": [],
        "documented_limit": None,
        "rows": 0,
        "error": None,
    }

    try:
        with open(field_map_json_path, "r", encoding="utf-8") as f:
            field_map = json.load(f)

        if engine == "docxtpl":
            context = build_context(field_map)
            render_res = render_docx_template(template_path, context, out_path)
        elif engine == "run_replace":
            flat = _flat_scalars(field_map)
            render_res = run_replace_docx(template_path, flat, out_path)
        elif engine == "acroform":
            fmt = "pdf"
            render_res = fill_acroform(template_path, _flat_scalars(field_map), out_path)
        else:
            verdict["error"] = "unknown engine %r" % engine
            print(json.dumps(verdict))
            return

        verdict["rendered"] = bool(render_res.get("rendered"))
        if not verdict["rendered"]:
            verdict["error"] = render_res.get("error") or "render failed"
            print(json.dumps(verdict))
            return

        # Integrity re-open with the SAME library — raises if the file won't open.
        try:
            integ = assert_integrity(out_path, fmt)
            verdict["opened"] = bool(integ.get("opened"))
            verdict["residual_clean"] = bool(integ.get("residual_clean"))
            verdict["residual_tags"] = integ.get("residual_tags") or []
            verdict["documented_limit"] = integ.get("documented_limit")
            verdict["rows"] = integ.get("rows", 0)
            if integ.get("refused"):
                verdict["refused"] = integ["refused"]
            if integ.get("error"):
                verdict["error"] = integ["error"]
        except Exception as exc:  # produced file is corrupt / won't re-open
            verdict["opened"] = False
            verdict["error"] = "integrity re-open failed: %s" % exc
    except Exception as exc:  # never crash — the handler reads the verdict
        verdict["error"] = "%s: %s" % (type(exc).__name__, exc)

    print(json.dumps(verdict))


if __name__ == "__main__":
    main()
'''


# 101-06 CR-01 — out_filename is MODEL-controlled (prompt-injectable via untrusted
# document content) and was interpolated unquoted into the sandbox shell command. A
# strict single-basename allow-list (OOXML extension only, no path separators / shell
# metacharacters) is the FIRST line of defense; argv-quoting in the handler is the
# structural second. A bad name falls back to a safe default so the happy path keeps
# working (least-surprising — documented in _handle_render_template's docstring).

_SAFE_OUT_FILENAME_RE = _re_filename.compile(r"^[A-Za-z0-9._ -]+\.(docx|pptx|xlsx|pdf)$")
# The engine token is server-generated (select_engine, or "acroform" for a .pdf template —
# Phase 291) but we whitelist it before interpolation anyway (defense-in-depth — CR-01 step 3).
_VALID_RENDER_ENGINES = frozenset({"docxtpl", "run_replace", "acroform"})


def _safe_out_filename(raw: str | None, template_ext: str) -> str:
    """101-06 CR-01 — coerce a model-supplied out_filename to a SAFE basename.

    Accepts a single basename matching ``^[A-Za-z0-9._ -]+\\.(docx|pptx|xlsx|pdf)$`` (no
    ``/`` ``\\`` ``..`` and no shell metacharacters ``; | & $ ( ) ` < > * ? '"``).
    The returned extension is ALWAYS the template's (291 WR-03); the model picks only the stem.
    On reject, falls back to ``deliverable.<ext>`` using the TEMPLATE's extension
    (one of docx/pptx/xlsx/pdf; defaults to docx) so the happy path keeps working
    rather than failing the whole render on a cosmetic filename.
    """
    ext = template_ext if template_ext in ("docx", "pptx", "xlsx", "pdf") else "docx"
    candidate = (raw or "").strip()
    if candidate and _SAFE_OUT_FILENAME_RE.match(candidate):
        # 291 WR-03: the output kind is the template's kind, whatever name the model asked
        # for. A Word template named "report.pdf" would render docx bytes into a .pdf and fail
        # integrity, so the model's stem is kept and the extension follows the template.
        return f"{candidate.rsplit('.', 1)[0]}.{ext}"
    return f"deliverable.{ext}"


async def _handle_render_template(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 101 (TMPL-02 / TMPL-03) — fill a template into a real deliverable.

    The integration piece. The LLM emits the cited field-map as this tool's typed
    argument; the handler:
      1. truncation-guards the emission (D-08 — never accept a truncated empty map),
      2. runs the citation/coverage gate BEFORE render (D-08 failure class 1 —
         reject an uncited/invented field-map without rendering),
      3. resolves template bytes by provenance (Plan 03) + selects the engine (Plan 02),
      4. ships the bytes + field-map JSON + the render driver into the SEALED sandbox
         (Pitfall 4 / D-12) and harvests the produced file + integrity verdict,
      5. runs the integrity gate AFTER render (D-08 failure class 2 — a non-opening
         file is NEVER persisted; the cited field-map is preserved as fallback),
      6. persists the deliverable + reuses the workspace_file_written SSE → OutputFileCard
         ONLY when BOTH gates pass (no new UI).

    Inert unless the model calls render_template — Deep stays byte-identical.

    Security (101-06 CR-01): ``out_filename`` is MODEL-controlled (prompt-injectable via
    untrusted document content). It is coerced to a strict OOXML basename
    (``_safe_out_filename`` — path-separator / shell-metachar reject → SAFE DEFAULT
    ``deliverable.<ext>``; the least-surprising choice — a cosmetic bad name never fails
    the whole render). The sandbox command is then built argv-safely (``shlex.quote``
    EVERY token) so no derived value can break out of the shell string.

    Tool argument schema::

        {
          "asset": {asset_id, filename, kind, mime} | null,  # null => ephemeral upload
          "field_map": {"scalars": {...}, "collections": {...}},
          "retrieved_ids": [...],   # the spotlight ids the citation check validates against
          "out_filename": "...",     # sanitized to a safe OOXML basename (CR-01)
          "emission_meta": {stop_reason | finish_reason}  # optional truncation meta
        }
    """
    # The deterministic core (Plan 02) + the byte resolver (Plan 03). These import
    # CLEAN in the backend venv — the heavy libs (docxtpl/...) are only SHIPPED into
    # the sandbox via _RENDER_DRIVER_SRC, never executed in-process here (Pitfall 4).
    from app.services.template_render_service import check_coverage, select_engine
    from app.services.template_asset_service import own_claim_for_ctx, resolve_template_source

    import json as _json_local
    import os as _os_local
    import tempfile as _tempfile_local
    import uuid as _uuid_mod

    field_map = args.get("field_map")
    retrieved_ids = set(args.get("retrieved_ids") or [])
    # 101-06 CR-01: the RAW model-supplied name — used only as a benign fallback for
    # src_name below. The SANITIZED basename (_safe_out_filename) is derived AFTER the
    # template extension is known and is what reaches the sandbox command / harvest /
    # persist. NEVER interpolate raw_out_filename into a shell string or a path.
    raw_out_filename = (args.get("out_filename") or "").strip()

    # ── 1. Truncation guard (D-08) ──────────────────────────────────────────────
    # A truncated tool-JSON emission silently drops collections — never treat it as a
    # valid empty field-map. is_truncated lives in template_render_service; import it
    # lazily alongside the other pure helpers to keep the module-top surface clean.
    from app.services.template_render_service import is_truncated

    emission_meta = args.get("emission_meta") or {}
    if is_truncated(emission_meta):
        return ToolResult(result=_json_local.dumps({
            "status": "rejected",
            "reason": "truncated_emission",
            "message": (
                "The field-map emission was truncated (max_tokens / length). "
                "Re-emit the render_template field-map with a higher output budget."
            ),
        }))

    if not isinstance(field_map, dict) or not field_map:
        return ToolResult(result=_json_local.dumps({
            "status": "rejected",
            "reason": "empty_field_map",
            "message": "render_template requires a non-empty `field_map` argument.",
        }))

    # ── 2. Citation / coverage gate — BEFORE render (D-08 failure class 1) ───────
    # placeholder_keys: the field-map's own scalar+collection (or flat) keys. The
    # template's exact key set is verified at render time by docxtpl; here we only
    # need a key list for the coverage stat shape — the load-bearing assertion is the
    # uncited/invented counts, which are key-list-independent.
    scalars = field_map.get("scalars")
    collections = field_map.get("collections")
    if scalars is not None or collections is not None:
        placeholder_keys = list((scalars or {}).keys()) + list((collections or {}).keys())
    else:
        placeholder_keys = list(field_map.keys())

    stats = check_coverage(field_map, retrieved_ids, placeholder_keys)
    # CR-02 (102-08): the gate is POLICY-AWARE. When a non-strict citation_policy
    # (flag/partial/draft) was applied UPSTREAM (the executor's _exec_llm_emit non-strict
    # branch set citation_policy_applied — a server-set value, never the model/definition
    # JSONB), the map was DELIBERATELY marked/blanked/labeled and the policy decision was
    # already made + receipted (policy_applied) + surfaced-on-success. The gate no longer
    # re-rejects that policy-modified map. The STRICT path (no citation_policy_applied)
    # rejects an uncited/invented map exactly as today — the default trust bar holds
    # byte-identical (T-102-08-01).
    if (stats["uncited_value_count"] > 0 or stats["invented_citation_count"] > 0) \
            and not args.get("citation_policy_applied"):
        return ToolResult(result=_json_local.dumps({
            "status": "rejected",
            "reason": "uncited_or_invented",
            "message": (
                "The field-map has uncited or invented values — every non-null value "
                "must cite a source_chunk_id that was actually retrieved. "
                "Re-emit with valid citations or set unsupported values to null."
            ),
            "stats": stats,
        }))

    # ── 3. Resolve template bytes by provenance (Plan 03) + select engine (Plan 02) ─
    asset = args.get("asset")
    asset_ref = None
    if asset:
        try:
            from app.models.harness import AssetRef
            asset_ref = AssetRef.model_validate(asset)
        except Exception as exc:  # malformed asset ref — honest error, never a raw raise
            return ToolResult(result=_json_local.dumps({
                "status": "error",
                "reason": "bad_asset_ref",
                "message": f"Invalid `asset` reference: {exc}",
            }))

    # Phase 141 (COLL-02): run-scope the ephemeral (Branch 2) resolve. own_claim is
    # SERVER-DERIVED from ctx.workflow_run_id (None→'deep', else str(W)) — NEVER from the
    # model's tool args (D-141 / Tampering). Correct for all three ctx shapes that reach
    # here: Deep (None→'deep'), workflow sub-agent (inherited W→str(W)), and the emit
    # re-dispatch (_ProducerStreamCtx whose workflow_run_id is stamped in the harness).
    own_claim = own_claim_for_ctx(ctx)
    src = await resolve_template_source(
        pool=ctx.pool,
        supabase=ctx.supabase,
        thread_id=ctx.thread_id,
        user_id=ctx.current_user["id"],
        asset_ref=asset_ref,
        own_claim=own_claim,
    )
    if src.get("error"):
        # Run-honesty (D-05/D-10): relay the clean resolver error, never a traceback.
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "template_resolution",
            "message": src["error"],
        }))

    template_bytes = src.get("bytes")
    if not template_bytes:
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "no_template_bytes",
            "message": "Template resolved without bytes — nothing to render.",
        }))

    engine = select_engine(src["provenance"])
    # 101-06 CR-01 step 3 — defense-in-depth: the engine token is server-generated by
    # select_engine, but whitelist it before it is ever interpolated into the command.
    if engine not in _VALID_RENDER_ENGINES:
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "bad_engine",
            "message": f"select_engine returned an unexpected engine {engine!r}.",
        }))

    # The template extension drives the in-container temp path + the driver fmt.
    src_name = src.get("filename") or raw_out_filename or "deliverable.docx"
    template_ext = (_os_local.path.splitext(src_name)[1] or ".docx").lstrip(".").lower() or "docx"

    # 101-06 CR-01: coerce the model-supplied name to a SAFE OOXML basename (strict
    # allow-list; path-separator / shell-metachar reject → safe default). From here on
    # `out_filename` is the SANITIZED value — it is what reaches the sandbox command,
    # the harvest match, and the workspace persist path.
    out_filename = _safe_out_filename(raw_out_filename, template_ext)

    # Phase 291 (D-25): a fillable PDF is filled through its OWN fields. The engine follows the
    # template's extension here; select_engine stays the docx provenance boundary, unchanged.
    # The output of a PDF form is always a .pdf (_safe_out_filename ties every output's
    # extension to the template's — 291 WR-03).
    if template_ext == "pdf":
        engine = "acroform"

    # ── 4. Render in the SEALED sandbox (Pitfall 4 / D-12 / D-13) ────────────────
    # No local-venv fallback — that would breach TMPL-03 (render MUST be sandboxed).
    if not settings.sandbox_enabled:
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "sandbox_disabled",
            "message": (
                "Template render requires the sandbox (SANDBOX_ENABLED=false). "
                "Enable the sandbox to render templates — there is no in-process fallback."
            ),
        }))

    container_template = f"/tmp/template-{_uuid_mod.uuid4().hex}.{template_ext}"
    container_field_map = f"/tmp/field_map-{_uuid_mod.uuid4().hex}.json"
    container_driver = f"/tmp/render_driver-{_uuid_mod.uuid4().hex}.py"
    container_out = f"/sandbox/output/{out_filename}"

    def _ship_and_run() -> dict:
        """Synchronous sandbox interaction (run in a threadpool — blocking I/O)."""
        session = sandbox_manager.get_or_create(ctx.thread_id)
        try:
            session.execute_command("mkdir -p /sandbox/output")
        except Exception:
            pass

        # Ship: template bytes, field-map JSON, the render driver — each via a local
        # NamedTemporaryFile then copy_to_runtime (mirrors _handle_execute_code:627-634).
        def _copy_in(local_bytes: bytes, container_path: str, *, text: bool):
            mode = "w" if text else "wb"
            suffix = ".py" if container_path.endswith(".py") else None
            kwargs: dict = {"mode": mode, "delete": False}
            if text:
                kwargs["encoding"] = "utf-8"
            if suffix:
                kwargs["suffix"] = suffix
            with _tempfile_local.NamedTemporaryFile(**kwargs) as _tmp:
                _tmp.write(local_bytes.decode("utf-8") if text else local_bytes)
                _local = _tmp.name
            try:
                session.copy_to_runtime(_local, container_path)
            finally:
                try:
                    _os_local.unlink(_local)
                except OSError:
                    pass

        _copy_in(template_bytes, container_template, text=False)
        _copy_in(_json_local.dumps(field_map).encode("utf-8"), container_field_map, text=False)
        _copy_in(_RENDER_DRIVER_SRC.encode("utf-8"), container_driver, text=False)

        # 101-06 CR-01: build the command argv-safely — shlex.quote EVERY token rather
        # than f-string-concatenating into one shell string. The three UUID paths are
        # server-generated (safe), the engine is whitelisted (_VALID_RENDER_ENGINES),
        # and out_filename is already a sanitized basename (_safe_out_filename) — but we
        # quote uniformly so no model/derived value can ever break out of the command
        # even if a future code path relaxes an upstream check (defense-in-depth).
        import shlex as _shlex_local

        cmd = " ".join(
            _shlex_local.quote(tok)
            for tok in (
                "python", "-u", container_driver, engine,
                container_template, container_field_map, container_out,
            )
        )
        exec_result = session.execute_command(cmd)
        stdout = getattr(exec_result, "stdout", None)
        if stdout is None:
            stdout = str(exec_result)

        # Parse the LAST JSON line of stdout (the driver prints exactly one verdict line).
        verdict_parsed = None
        for line in reversed([ln for ln in stdout.splitlines() if ln.strip()]):
            try:
                verdict_parsed = _json_local.loads(line)
                break
            except (ValueError, TypeError):
                continue

        produced: bytes | None = None
        if verdict_parsed and verdict_parsed.get("rendered") and verdict_parsed.get("opened"):
            # Harvest the single produced file (mirror harvest_output_files:261-273).
            with _tempfile_local.TemporaryDirectory() as _td:
                session.copy_from_runtime("/sandbox/output", _td)
                for _root, _dirs, _files in _os_local.walk(_td):
                    for _fn in _files:
                        if _fn == out_filename:
                            with open(_os_local.path.join(_root, _fn), "rb") as _fp:
                                produced = _fp.read()
                            break
                    if produced is not None:
                        break

        return {"verdict": verdict_parsed, "stdout": stdout, "produced": produced}

    try:
        run_out = await run_in_threadpool(_ship_and_run)
    except Exception as exc:  # noqa: BLE001 — honest error, never a raw raise to the loop
        msg = str(exc)
        if "ModuleNotFoundError" in type(exc).__name__ or "docxtpl" in msg:
            return ToolResult(result=_json_local.dumps({
                "status": "error",
                "reason": "sandbox_image_stale",
                "message": (
                    "The sandbox image is missing docxtpl. Rebuild it "
                    "(docker build -f backend/Dockerfile.sandbox ...), bump SANDBOX_IMAGE, "
                    "and start a NEW chat (cached sessions keep the old image)."
                ),
            }))
        logger.warning("render_template sandbox run failed thread=%s err=%s", ctx.thread_id, msg)
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "sandbox_error",
            "message": f"Template render failed in the sandbox: {msg}",
        }))

    verdict = run_out.get("verdict")
    produced = run_out.get("produced")

    if not verdict:
        # A missing/garbled verdict is a FAILURE — never persist (T-101-04-05).
        return ToolResult(result=_json_local.dumps({
            "status": "failed",
            "reason": "no_verdict",
            "message": "The sandbox render produced no parseable verdict — not delivering.",
            "field_map": field_map,
        }))

    # ── 5. Integrity gate — AFTER render (D-08 failure class 2) ──────────────────
    # 101-06 WR-03: the gate must ALSO consult residual_clean. A file that opens cleanly
    # but still contains unsubstituted placeholder markup ({{token}} survivors — a silent
    # non-fill, T-101-02-05) was previously delivered. The VALIDATION contract (SC#4 #1)
    # makes residual-scan == [] the PASS signal. Default residual_clean=True so an OLDER
    # driver verdict missing the key doesn't hard-fail (back-compat); the CURRENT driver
    # always emits it. residual_tags surfaces in the failure payload so the harness
    # bounded-retry loop can re-render rather than ship a half-filled file.
    residual_clean = verdict.get("residual_clean", True)
    if not (verdict.get("rendered") and verdict.get("opened") and residual_clean):
        # A corrupt / non-opening / residual-tainted file is NEVER delivered (SC#4 #3).
        # Preserve the cited field-map as fallback output so the extracted data isn't
        # lost (D-08), and the harness bounded-retry loop re-renders.
        reason = "residual_tokens" if (verdict.get("rendered") and verdict.get("opened")) else "integrity"
        msg = (
            "The rendered file opened but still contains unsubstituted placeholder tokens "
            "(a silent non-fill) and was NOT delivered. The cited field-map is preserved "
            "below as fallback."
            if reason == "residual_tokens"
            else "The rendered file failed the integrity re-open and was NOT delivered. "
                 "The cited field-map is preserved below as fallback."
        )
        return ToolResult(result=_json_local.dumps({
            "status": "failed",
            "reason": reason,
            "message": msg,
            "residual_tags": verdict.get("residual_tags") or [],
            "verdict": verdict,
            "field_map": field_map,
        }))

    if produced is None:
        return ToolResult(result=_json_local.dumps({
            "status": "failed",
            "reason": "harvest_failed",
            "message": "The rendered file passed integrity but could not be harvested.",
            "verdict": verdict,
            "field_map": field_map,
        }))

    # ── 6. Persist + SSE — only when BOTH gates pass ────────────────────────────
    # 101-06 WR-02: workspace_service.validate_path REQUIRES a leading "/". out_filename
    # is a bare basename (e.g. "deliverable.docx"), so a bare path raised
    # PathValidationError → caught → persist_failed → a deliverable that passed BOTH
    # gates was silently dropped (the exact data-loss the gates prevent, on the SUCCESS
    # branch). Normalize to a leading-slash workspace path here. NOTE: the harvest loop
    # above keys on the bare basename `out_filename` (the file in /sandbox/output) — only
    # the WORKSPACE persist path gets the leading slash.
    ws_path = out_filename if out_filename.startswith("/") else "/" + out_filename
    try:
        result = await ws_write_file(
            ctx.pool, ctx.supabase,
            thread_id=UUID(ctx.thread_id),
            user_id=UUID(ctx.current_user["id"]),
            path=ws_path,
            content=produced,
        )
    except WorkspaceError as e:
        return ToolResult(result=_json_local.dumps({
            "status": "failed",
            "reason": "persist_failed",
            "message": str(e),
            "verdict": verdict,
            "field_map": field_map,
        }))

    # VERBATIM reuse of the workspace_file_written event so OutputFileCard renders it
    # (no new UI). Same shared SSE vocabulary for every provider — no per-provider branch.
    await ctx.emit(
        ctx.redis, ctx.run_id, 'workspace_file_written',
        id=result["file_id"],
        path=result["path"],
        version=result["version"],
        size_bytes=result["size_bytes"],
        mime_type=result["mime_type"],
    )

    # Success: carry the verdict (incl. documented_limit — "no silent caps", D-06) +
    # the coverage stats (D-10: citations live in run OUTPUT only; the delivered file
    # stays clean — no citation markup is written into the file itself).
    return ToolResult(result=_json_local.dumps({
        "status": "ok",
        "path": result["path"],
        "version": result["version"],
        "size_bytes": result["size_bytes"],
        "provenance": src["provenance"],
        "engine": engine,
        "verdict": verdict,
        "coverage": stats,
    }))
