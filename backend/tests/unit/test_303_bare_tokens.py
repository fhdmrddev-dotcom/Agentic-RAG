"""Phase 303 (FIX-15 / BUG-261022-01): bare Word tokens fill, or fail the integrity check.

The defect, reproduced at base through the REAL driver script (evidence/red-base):

1. docxtpl (library templates): a bare ``{{ name }}`` printed the whole cited record,
   ``{'value': 'Ann', 'source_chunk_id': 'c1', ...}``, into body, header, footer, cells,
   nested tables and loop rows, while the verdict read ``residual_clean: true``.
2. run_replace (uploaded templates): ``{{ name }}`` and ``{{ name.value }}`` were BLANKED,
   because only the tight ``{{name}}`` was matched.
3. Nested tables (and header tables, first-page / even-page headers and footers) were
   invisible to both the run_replace walk and the residual scan.

Every behaviour here runs against BOTH copies of the fill code: the sealed sandbox driver
(``_RENDER_DRIVER_SRC``, loaded by exec with a ``__name__`` that is never ``"__main__"``)
and the in-app ``template_render_service``. ``test_303_driver_service_parity.py`` pins the
two copies to each other; this file pins each copy to the behaviour.

Names that only exist after the fix (``_RECORD_TEXT_PREFIX``) are read with getattr /
dict.get inside the tests, so a RED run fails on an assertion, never at collection.
"""

from __future__ import annotations

import asyncio
import json
import pathlib
import subprocess
import sys
import zipfile

import pytest
from docx import Document
from jinja2.sandbox import SandboxedEnvironment

import app.services.template_render_service as svc
from app.services.tools.render_template import _RENDER_DRIVER_SRC

_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "templates"
SPLIT_TOKEN_DOCX = _FIXTURES / "arbitrary-split-token.docx"

RECORD_PREFIX = "record text: "

# The repro's field map (evidence/red-base/repro.py).
FM = {
    "scalars": {
        "name": {"value": "Ann", "source_chunk_id": "c1", "source_doc": "d.pdf", "source_page": 2},
    },
    "collections": {
        "rows": [
            {"cause": {"value": "Late vendor", "source_chunk_id": "c2", "source_doc": None, "source_page": None}},
        ],
    },
}


# ── the two copies ────────────────────────────────────────────────────────────


def _load_driver() -> dict:
    ns: dict = {"__name__": "render_driver_under_test"}
    exec(compile(_RENDER_DRIVER_SRC, "<render_driver>", "exec"), ns)
    return ns


class _Copy:
    """One copy's functions behind one interface, so each test runs on both."""

    def __init__(self, which: str):
        self.which = which
        if which == "driver":
            self.ns = _load_driver()
        else:
            self.ns = {name: getattr(svc, name) for name in dir(svc)}

    def __getattr__(self, name):
        try:
            return self.ns[name]
        except KeyError as exc:  # pragma: no cover - surfaced as a test failure
            raise AttributeError(name) from exc

    def run_replace(self, template_path, scalars: dict, out_path) -> dict:
        """Both copies' run_replace_docx: the driver takes flat strings, the service
        takes the cited dicts and flattens them itself."""
        if self.which == "driver":
            flat = self.ns["_flat_scalars"]({"scalars": scalars})
            return self.ns["run_replace_docx"](str(template_path), flat, str(out_path))
        return svc.run_replace_docx(str(template_path), scalars, str(out_path))


COPIES = pytest.mark.parametrize("which", ["driver", "service"], ids=["driver", "service"])


# ── fixture builders / readers ────────────────────────────────────────────────


def build(
    path,
    *,
    body=None,
    header=None,
    footer=None,
    cell=None,
    nested=None,
    loop=None,
    header_cell=None,
    first_header=None,
    first_footer=None,
    even_header=None,
    even_footer=None,
    paragraphs=None,
):
    """A python-docx template with a token in each named location (None = location absent).

    ``loop`` is ``(cause_token, score_token)`` for a ``{%tr for r in rows %}`` table.
    Header/footer parts are only touched when a token is placed there, so a builder call
    with no header argument produces a document with no header definition.
    """
    from docx.shared import Inches

    d = Document()
    for text in paragraphs or []:
        d.add_paragraph(text)
    if body is not None:
        d.add_paragraph("Body: " + body)
    sec = d.sections[0]
    if header is not None:
        sec.header.paragraphs[0].text = "Header: " + header
    if footer is not None:
        sec.footer.paragraphs[0].text = "Footer: " + footer
    if header_cell is not None:
        ht = sec.header.add_table(rows=1, cols=1, width=Inches(6))
        ht.cell(0, 0).text = "HeaderCell: " + header_cell
    if cell is not None or nested is not None:
        t = d.add_table(rows=1, cols=1)
        t.cell(0, 0).text = "Cell: " + (cell or "")
        if nested is not None:
            inner = t.cell(0, 0).add_table(rows=1, cols=1)
            inner.cell(0, 0).text = "Nested: " + nested
    if loop is not None:
        lt = d.add_table(rows=3, cols=2)
        lt.cell(0, 0).text = "{%tr for r in rows %}"
        lt.cell(1, 0).text = loop[0]
        lt.cell(1, 1).text = loop[1]
        lt.cell(2, 0).text = "{%tr endfor %}"
    if first_header is not None or first_footer is not None:
        sec.different_first_page_header_footer = True
        if first_header is not None:
            sec.first_page_header.paragraphs[0].text = "FirstHeader: " + first_header
        if first_footer is not None:
            sec.first_page_footer.paragraphs[0].text = "FirstFooter: " + first_footer
    if even_header is not None or even_footer is not None:
        d.settings.odd_and_even_pages_header_footer = True
        if even_header is not None:
            sec.even_page_header.paragraphs[0].text = "EvenHeader: " + even_header
        if even_footer is not None:
            sec.even_page_footer.paragraphs[0].text = "EvenFooter: " + even_footer
    d.save(str(path))
    return path


def all_texts(path) -> list[str]:
    """Every paragraph's text: body, every table cell recursively (nested tables), and
    every header/footer variant that has its own definition."""
    d = Document(str(path))
    out: list[str] = []

    def paras(container):
        out.extend(p.text for p in container.paragraphs)
        tables(container.tables)

    def tables(ts):
        for t in ts:
            for row in t.rows:
                for c in row.cells:
                    paras(c)

    paras(d)
    for s in d.sections:
        for hf in (
            s.header,
            s.first_page_header,
            s.even_page_header,
            s.footer,
            s.first_page_footer,
            s.even_page_footer,
        ):
            if not hf.is_linked_to_previous:
                paras(hf)
    return out


def _no_record_text(texts):
    leaked = [t for t in texts if "source_chunk_id" in t]
    assert not leaked, f"record text reached the document: {leaked}"


def _assert_bare_render(texts):
    for expected in ("Body: Ann", "Header: Ann", "Footer: Ann", "Cell: Ann", "Nested: Ann", "Late vendor"):
        assert expected in texts, f"{expected!r} missing; document text: {texts}"
    _no_record_text(texts)


def _bare_template(tmp_path):
    tok = "{{ name }}"
    return build(
        tmp_path / "bare_template.docx",
        body=tok,
        header=tok,
        footer=tok,
        cell=tok,
        nested=tok,
        loop=("{{ r.cause }}", "{{ r.score }}"),
    )


# ── SC#1 / SC#2: docxtpl bare tokens, through the real driver script and the service ──


def test_driver_script_docxtpl_bare_tokens_render_values(tmp_path):
    """D-01: the in-suite form of the RED repro. _RENDER_DRIVER_SRC runs as a script,
    with the same four positional args the sandbox passes, not as a mirror."""
    driver = tmp_path / "render_driver.py"
    driver.write_text(_RENDER_DRIVER_SRC, encoding="utf-8")
    tpl = _bare_template(tmp_path)
    fmp = tmp_path / "field_map.json"
    fmp.write_text(json.dumps(FM), encoding="utf-8")
    out = tmp_path / "out.docx"

    proc = subprocess.run(
        [sys.executable, "-u", str(driver), "docxtpl", str(tpl), str(fmp), str(out)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    lines = proc.stdout.strip().splitlines()
    assert lines, f"driver printed no verdict; stderr: {proc.stderr[-400:]}"
    verdict = json.loads(lines[-1])
    assert verdict["rendered"] is True, verdict
    assert verdict["opened"] is True, verdict
    assert verdict["residual_clean"] is True, verdict
    _assert_bare_render(all_texts(out))


def test_service_docxtpl_bare_tokens_render_values(tmp_path):
    tpl = _bare_template(tmp_path)
    out = tmp_path / "out.docx"
    ctx = svc.build_context(FM)
    res = svc.render_docx_template(str(tpl), ctx, str(out))
    assert res.get("rendered") is True, res
    verdict = svc.assert_integrity(str(out), "docx")
    assert verdict["residual_clean"] is True, verdict
    _assert_bare_render(all_texts(out))


@COPIES
def test_whole_record_printed_is_not_delivered(which, tmp_path):
    """D-05 / D-07: what coercion cannot reach (a whole row, a whole list) is caught by
    the residual scan as record text, so residual_clean is false and it is not delivered."""
    c = _Copy(which)
    tpl = build(tmp_path / "record.docx", body="{{ rows }}", loop=("{{ r }}", "{{ r.score }}"))
    out = tmp_path / "out.docx"
    c.render_docx_template(str(tpl), c.build_context(FM), str(out))
    texts = all_texts(out)
    assert any("source_chunk_id" in t for t in texts), f"fixture did not print a record: {texts}"
    verdict = c.assert_integrity(str(out), "docx")
    assert verdict["residual_clean"] is False, verdict
    tags = verdict["residual_tags"]
    assert any(t.startswith(RECORD_PREFIX) for t in tags), tags


# ── D-06: the coerced cell inside the real sandbox ───────────────────────────


@COPIES
def test_bare_name_escapes_exactly_like_value(which):
    c = _Copy(which)
    cell = c._cell({"value": "A & <b>", "source_chunk_id": "c1", "source_doc": None, "source_page": None})
    env = SandboxedEnvironment(autoescape=True)
    bare = env.from_string("{{ name }}").render(name=cell)
    dotted = env.from_string("{{ name.value }}").render(name=cell)
    assert dotted == "A &amp; &lt;b&gt;"
    assert bare == dotted


@COPIES
def test_value_default_if_forms_unchanged(which):
    """Regression guard (passes at base): every form a shipped template uses renders as
    before. Note: ``{{ missing.value|default(..) }}`` raises UndefinedError in Jinja at
    base already (attribute of an undefined name), so the missing-key form tested is
    ``{{ name.nope|default(..) }}`` / ``{{ missing|default(..) }}``."""
    c = _Copy(which)
    ctx = c.build_context(FM)
    env = SandboxedEnvironment(autoescape=True)

    def r(src):
        return env.from_string(src).render(**ctx)

    assert r("{{ name.value }}") == "Ann"
    assert r("{{ name.value|default('N/A') }}") == "Ann"
    assert r("{{ name.nope|default('N/A') }}") == "N/A"
    assert r("{{ missing|default('N/A') }}") == "N/A"
    assert r("{% if name %}yes{% endif %}") == "yes"
    assert r("{% for x in rows %}{{ x.cause.value }}|{{ x.score }}{% endfor %}") == "Late vendor|"
    assert ctx == json.loads(json.dumps(ctx)), "the context must still equal plain dicts"


# ── D-08: run_replace key match ─────────────────────────────────────────────


@COPIES
def test_run_replace_fills_spaced_tight_and_value_forms(which, tmp_path):
    c = _Copy(which)
    tpl = build(
        tmp_path / "forms.docx",
        paragraphs=["A {{name}}", "B {{ name }}", "C {{  name  }}", "D {{ name.value }}"],
    )
    out = tmp_path / "out.docx"
    c.run_replace(tpl, FM["scalars"], out)
    body = [p.text for p in Document(str(out)).paragraphs]
    assert body == ["A Ann", "B Ann", "C Ann", "D Ann"]


@COPIES
def test_run_replace_fills_nested_table_and_header_variants(which, tmp_path):
    """D-09: the tight ``{{name}}`` form (already matched at base) isolates the walk-reach
    defect from the key-match one."""
    c = _Copy(which)
    tok = "{{name}}"
    tpl = build(
        tmp_path / "reach.docx",
        nested=tok,
        header_cell=tok,
        first_header=tok,
        first_footer=tok,
        even_header=tok,
        even_footer=tok,
    )
    out = tmp_path / "out.docx"
    c.run_replace(tpl, FM["scalars"], out)
    texts = all_texts(out)
    for expected in (
        "Nested: Ann",
        "HeaderCell: Ann",
        "FirstHeader: Ann",
        "FirstFooter: Ann",
        "EvenHeader: Ann",
        "EvenFooter: Ann",
    ):
        assert expected in texts, f"{expected!r} missing; document text: {texts}"


BACKSLASH_VALUE = r"x\1y\g<0>z\\"


@COPIES
def test_run_replace_inserts_backslash_values_literally(which, tmp_path):
    c = _Copy(which)
    tpl = build(tmp_path / "bs.docx", paragraphs=["V: {{ name }}"])
    out = tmp_path / "out.docx"
    c.run_replace(tpl, {"name": {"value": BACKSLASH_VALUE, "source_chunk_id": "c1"}}, out)
    assert [p.text for p in Document(str(out)).paragraphs] == ["V: " + BACKSLASH_VALUE]


@COPIES
def test_run_replace_still_blanks_unknown_tokens(which, tmp_path):
    """Regression guard (passes at base): the lean-blank design for unknown placeholder
    tokens is unchanged, and a non-placeholder literal is left alone."""
    c = _Copy(which)
    tpl = build(tmp_path / "unk.docx", paragraphs=["U {{ unknown }}", "V {{unknown}}", "W {{ 1 + 1 }}"])
    out = tmp_path / "out.docx"
    c.run_replace(tpl, FM["scalars"], out)
    assert [p.text for p in Document(str(out)).paragraphs] == ["U ", "V ", "W {{ 1 + 1 }}"]


@COPIES
def test_run_replace_adds_no_header_footer_part(which, tmp_path):
    """Regression guard (passes at base): a body-only template gains no first-page or
    even-page header/footer on output. The default header/footer access that already
    exists adds at most one of each."""
    c = _Copy(which)
    out = tmp_path / "out.docx"
    c.run_replace(SPLIT_TOKEN_DOCX, {"client_name": "Acme", "report_title": "Q3"}, out)
    with zipfile.ZipFile(str(out)) as z:
        names = z.namelist()
        document_xml = z.read("word/document.xml").decode("utf-8")
    headers = [n for n in names if n.startswith("word/header")]
    footers = [n for n in names if n.startswith("word/footer")]
    assert len(headers) <= 1, names
    assert len(footers) <= 1, names
    assert 'w:type="first"' not in document_xml
    assert 'w:type="even"' not in document_xml


# ── D-09: the residual scan's reach ─────────────────────────────────────────


@COPIES
@pytest.mark.parametrize("where", ["nested", "header", "footer", "first_header"])
def test_residual_scan_reaches_nested_header_footer_and_first_page(which, where, tmp_path):
    c = _Copy(which)
    p = build(tmp_path / f"surv_{where}.docx", **{where: "{{name}}"})
    hits = c.residual_tags_in(str(p), "docx")
    assert hits, f"a surviving {{{{name}}}} in the {where} was not seen"


def _parse(path):
    return svc.parse_docx_template_variables(pathlib.Path(path).read_bytes())


# ── D-17 (303-REVIEW CR-01): the parse oracle names a bare loop column ──────


def test_oracle_records_bare_loop_column_but_not_score(tmp_path):
    """A bare ``{{ r.cause }}`` is a column the model must emit. Before D-17 the oracle only
    recorded ``{{ r.col.value }}``, so the emit prompt never named ``cause``, the model
    guessed another key, and the cell rendered blank with a clean verdict. ``score`` stays
    out: the driver computes it (``_build_row``'s default-blank derived field)."""
    tpl = build(tmp_path / "bare_loop.docx", body="{{ name }}", loop=("{{ r.cause }}", "{{ r.score }}"))
    parsed = _parse(tpl)
    assert parsed is not None
    assert parsed["collections"] == ["rows"], parsed
    assert parsed["columns"] == {"rows": ["cause"]}, parsed
    assert parsed["scalars"] == ["name"], parsed
    assert svc.placeholder_names_from_parsed(parsed) == ["cause", "name"]


def test_oracle_records_bare_and_value_loop_columns_together(tmp_path):
    tpl = build(tmp_path / "mixed_loop.docx", loop=("{{ r.cause.value }}", "{{r.owner}}"))
    assert _parse(tpl)["columns"] == {"rows": ["cause", "owner"]}


_SHIPPED_DOCXTPL_TEMPLATES = [
    _FIXTURES / "risk-register.docx",
    *sorted((pathlib.Path(__file__).resolve().parents[3] / "scripts" / "pm-pack" / "templates").glob("*.docx")),
]


def _legacy_parse(path):
    """The pre-D-17 column rule (``.value`` loop derefs only), kept here as the reference
    every shipped template must still match."""
    import re as _re

    parsed = _parse(path)
    text = "".join(
        _re.sub(r"<[^>]+>", "", zipfile.ZipFile(str(path)).read(n).decode("utf-8", errors="ignore"))
        for n in zipfile.ZipFile(str(path)).namelist()
        if n == "word/document.xml" or _re.match(r"word/(?:header|footer)\d*\.xml$", n)
    )
    loop_vars = dict(
        _re.findall(r"\{%[^%]*?\bfor\s+([A-Za-z_]\w*)\s+in\s+([A-Za-z_]\w*)[^%]*?%\}", text)
    )
    columns: dict = {}
    for var, col in _re.findall(r"\{\{\s*([A-Za-z_]\w*)\.([A-Za-z_]\w*)\.value\s*\}\}", text):
        if var in loop_vars:
            columns.setdefault(loop_vars[var], set()).add(col)
    return {**parsed, "columns": {c: sorted(v) for c, v in columns.items()}}


@pytest.mark.parametrize("path", _SHIPPED_DOCXTPL_TEMPLATES, ids=lambda p: f"{p.parent.name}/{p.name}")
def test_oracle_unchanged_for_shipped_templates(path):
    """D-17: every shipped (``.value`` / ``{{ r.score }}``) template parses exactly as before."""
    assert len(_SHIPPED_DOCXTPL_TEMPLATES) == 4, _SHIPPED_DOCXTPL_TEMPLATES
    assert _parse(path) == _legacy_parse(path)


def test_service_run_replace_reports_spaced_keys_as_replaced(tmp_path):
    tpl = build(tmp_path / "sp.docx", paragraphs=["B {{ name }}"])
    res = svc.run_replace_docx(str(tpl), FM["scalars"], str(tmp_path / "out.docx"))
    assert "name" in res["replaced_keys"], res
    assert "name" not in res["unmatched_keys"], res


# ── D-07: the handler's worded reason ───────────────────────────────────────


def _noop_emit(*args, **kwargs):
    return None


def _make_ctx():
    from app.services.tool_dispatcher import ToolContext

    return ToolContext(
        redis=None,
        run_id="00000000-0000-0000-0000-0000000000ff",
        thread_id="11111111-1111-1111-1111-111111111111",
        supabase=object(),
        pool=object(),
        user_settings=None,
        current_user={"id": "22222222-2222-2222-2222-222222222222"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=_noop_emit,
        spawn=lambda *a, **k: None,
    )


def _run_handler_with_residuals(monkeypatch, residual_tags):
    """test_template_render.py::test_render_template_residual_tokens_not_delivered's
    harness, with the verdict's residual_tags swapped in."""
    import app.services.tools.render_template as td

    field_map = {
        "scalars": {"project_name": {"value": "Meridian", "source_chunk_id": "chunk-1"}},
        "collections": {},
    }

    async def _fake_resolve(*args, **kwargs):
        return {
            "bytes": b"PK\x03\x04 fake docx bytes",
            "filename": "template.docx",
            "provenance": "library",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "error": None,
        }

    monkeypatch.setattr("app.services.template_asset_service.resolve_template_source", _fake_resolve)
    monkeypatch.setattr(td.settings, "sandbox_enabled", True)

    async def _fake_threadpool(fn, *args, **kwargs):
        return {
            "verdict": {
                "rendered": True,
                "opened": True,
                "residual_clean": False,
                "residual_tags": list(residual_tags),
            },
            "stdout": "{}",
            "produced": b"PK\x03\x04 half-filled docx",
        }

    monkeypatch.setattr(td, "run_in_threadpool", _fake_threadpool)

    async def _boom_write(*args, **kwargs):
        raise AssertionError("ws_write_file must NOT be called when the gate fails")

    monkeypatch.setattr(td, "ws_write_file", _boom_write)

    args = {
        "field_map": field_map,
        "retrieved_ids": ["chunk-1"],
        "out_filename": "deliverable.docx",
        "asset": {
            "asset_id": "user/_library/template.docx",
            "filename": "template.docx",
            "kind": "template",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
    }
    result = asyncio.run(td._handle_render_template(args, _make_ctx()))
    return json.loads(result.result)


def test_handler_names_record_text_in_failure_message(monkeypatch):
    payload = _run_handler_with_residuals(
        monkeypatch, [RECORD_PREFIX + "Body: {'value': 'Ann', 'source_chunk_id': 'c1'"]
    )
    assert payload["status"] == "failed"
    assert payload["reason"] == "residual_tokens"
    assert "raw record text" in payload["message"], payload["message"]
    assert "not delivered" in payload["message"].lower(), payload["message"]


def test_handler_plain_residual_message_has_no_record_clause(monkeypatch):
    payload = _run_handler_with_residuals(monkeypatch, ["{{project_name}}"])
    assert payload["status"] == "failed"
    assert payload["reason"] == "residual_tokens"
    assert "raw record text" not in payload["message"], payload["message"]
