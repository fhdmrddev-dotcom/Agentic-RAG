
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
        if v is not None and hasattr(v, "get_object"):
            v = v.get_object()
        out.append({
            "name": name,
            "field_type": ftype,
            "states": states,
            "options": options,
            "tooltip": (_acro_str(tu).strip() or None) if tu is not None else None,
            "value": None if v is None else _acro_str(v),
            # 296-03 (291-WR-04): the TYPE of /V, so the read-back can tell a button that was set
            # (a PDF name) from one whose /V came back as a text string.
            "value_is_name": v is not None and type(v).__name__ == "NameObject",
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


def _name_button_values(writer, values):
    """296-03 (291-WR-04): write each checkbox / radio answer as a PDF NAME on its field node.

    pypdf writes a field's /V as a TEXT string and fixes the type only on a widget that is
    its own field (a lone checkbox). A radio group's /V lives on the parent, so it stayed
    text, and viewers that read /V by type saw an unset button."""
    from pypdf.generic import NameObject

    acro = writer._root_object.get("/AcroForm")
    top = acro.get_object().get("/Fields") if acro is not None else None
    if top is None:
        return
    seen = set()

    def _walk(ref, prefix, ft, depth):
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
        ft = node.get("/FT", ft)
        kids = node.get("/Kids")
        kids = list(kids.get_object()) if kids is not None else []
        field_kids = [k for k in kids if "/T" in k.get_object()]
        if field_kids:
            for k in field_kids:
                _walk(k, name, ft, depth + 1)
            return
        want = values.get(name)
        if str(ft) == "/Btn" and isinstance(want, str) and want.startswith("/"):
            node[NameObject("/V")] = NameObject(want)

    for ref in top.get_object():
        _walk(ref, "", None, 0)


def _write_values(writer, values):
    writer.update_page_form_field_values(None, values, auto_regenerate=False)
    _name_button_values(writer, values)


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
    # 291 UAT S6b: a refused answer is LEFT BLANK, as its sentence says. A form that already
    # carried a value there (a dropdown's default) would otherwise show that default under
    # "left blank". Cleared fields are written empty (a choice) or Off (a box) and read back.
    cleared = {}
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
                cleared[key] = "/Off"
                continue
            values[key] = matched
            continue
        # radio / choice: empty means no answer; anything else must be one of the field's own.
        if text.strip() == "":
            continue
        matched = _match_choice(text, field)
        if matched is None:
            refused.append({"field": key, "sentence": _refused_sentence(field)})
            cleared[key] = "/Off" if ftype == "radio" else ""
            continue
        values[key] = matched

    writer = PdfWriter(clone_from=PdfReader(template_path))
    if values or cleared:
        _write_values(writer, {**cleared, **values})
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
            # 296-03 (291-WR-04): a button's /V must come back as a NAME, not just spell right.
            typed = got["value"] is None or got["value_is_name"]
            if want == "/Off":
                ok = typed and (got["value"] in (None, "/Off")) and all(a == "/Off" for a in ases)
            else:
                ok = typed and got["value"] == want and want in ases
        else:
            ok = got["value"] == want
        if not ok:
            mismatch.append(key)
    for key, want in cleared.items():
        got = back.get(key)
        if got is None:
            continue
        if want == "/Off":
            typed = got["value"] is None or got["value_is_name"]
            ok = typed and (got["value"] in (None, "/Off")) and all(a == "/Off" for a in got["widget_as"])
        else:
            ok = got["value"] in (None, "")
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
