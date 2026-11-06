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


_TOKEN_IN_VALUE_ORDERS = {
    # The defect depended on dict order alone: an earlier key's inserted value was
    # re-scanned by every later key (rewritten) or by the unknown-token blank (erased).
    "client-first": ["client", "salary"],
    "salary-first": ["salary", "client"],
}


@COPIES
@pytest.mark.parametrize("order", sorted(_TOKEN_IN_VALUE_ORDERS))
def test_run_replace_never_rescans_an_inserted_value(which, order, tmp_path):
    """D-18 (303-REVIEW WR-02): a cited value is user data. A token-shaped string inside it
    is neither replaced by another key's value nor blanked; it survives literally, and the
    residual scan then fails the file honestly (never a silent rewrite)."""
    c = _Copy(which)
    values = {
        "client": {"value": "see {{ salary }} and {{ ghost }}", "source_chunk_id": "c1"},
        "salary": {"value": "120000", "source_chunk_id": "c2"},
    }
    scalars = {k: values[k] for k in _TOKEN_IN_VALUE_ORDERS[order]}
    tpl = build(tmp_path / "cascade.docx", paragraphs=["Client: {{client}} / Salary: {{ salary }}"])
    out = tmp_path / "out.docx"
    c.run_replace(tpl, scalars, out)
    body = [p.text for p in Document(str(out)).paragraphs]
    assert body == ["Client: see {{ salary }} and {{ ghost }} / Salary: 120000"], body
    assert c.residual_tags_in(str(out), "docx"), "a surviving token in a value must fail the scan"


def test_service_run_replace_counts_only_keys_in_the_template(tmp_path):
    """D-18: ``matched`` counts keys found in the template text, never inside an inserted value."""
    tpl = build(tmp_path / "m.docx", paragraphs=["Client: {{client}}"])
    res = svc.run_replace_docx(
        str(tpl),
        {"client": {"value": "see {{ salary }}"}, "salary": {"value": "120000"}},
        str(tmp_path / "out.docx"),
    )
    assert res["replaced_keys"] == ["client"], res
    assert res["unmatched_keys"] == ["salary"], res


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


_SCAN_LOCATIONS = [
    "nested",
    "header",
    "footer",
    "header_cell",
    "first_header",
    "first_footer",
    "even_header",
    "even_footer",
]


@COPIES
@pytest.mark.parametrize("where", _SCAN_LOCATIONS)
def test_residual_scan_reaches_nested_header_footer_and_first_page(which, where, tmp_path):
    """D-09 / D-21 (303-REVIEW IN-03): every location run_replace walks, the scan reads."""
    c = _Copy(which)
    p = build(tmp_path / f"surv_{where}.docx", **{where: "{{name}}"})
    hits = c.residual_tags_in(str(p), "docx")
    assert hits, f"a surviving {{{{name}}}} in the {where} was not seen"


@COPIES
@pytest.mark.parametrize("where", _SCAN_LOCATIONS)
def test_residual_scan_marks_record_text_in_every_location(which, where, tmp_path):
    c = _Copy(which)
    p = build(tmp_path / f"rec_{where}.docx", **{where: "{'value': 'Ann', 'source_chunk_id': 'c1'}"})
    hits = c.residual_tags_in(str(p), "docx")
    assert hits and all(h.startswith(RECORD_PREFIX) for h in hits), hits


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


def _make_ctx(emit=_noop_emit):
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
        emit=emit,
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
    assert "unsubstituted placeholder tokens" in payload["message"], payload["message"]
    assert payload["message"].lower().count("not delivered") == 1, payload["message"]


def test_handler_all_record_text_message_leads_with_the_record_cause(monkeypatch):
    """D-21 (303-REVIEW IN-02): when every hit is record text the stated cause is the
    template printing a whole record, said once, with the template-side fix (re-emitting
    the field map, which is all the bounded retry changes, cannot fix it)."""
    payload = _run_handler_with_residuals(
        monkeypatch,
        [RECORD_PREFIX + "Body: {'value': 'Ann', 'source_chunk_id': 'c1'", RECORD_PREFIX + "[{'cause': {"],
    )
    msg = payload["message"]
    assert payload["reason"] == "residual_tokens"
    assert msg.startswith("A field printed as raw record text"), msg
    assert "unsubstituted placeholder tokens" not in msg, msg
    assert msg.lower().count("not delivered") == 1, msg
    assert "{{ name.value }}" in msg, msg
    assert "fallback" in msg, msg


def test_handler_mixed_residual_message_names_both_causes_once(monkeypatch):
    payload = _run_handler_with_residuals(
        monkeypatch, ["{{project_name}}", RECORD_PREFIX + "Body: {'value': 'Ann', 'source_chunk_id': 'c1'"]
    )
    msg = payload["message"]
    assert "unsubstituted placeholder tokens" in msg, msg
    assert "raw record text" in msg, msg
    assert msg.lower().count("not delivered") == 1, msg


# ── D-19 (303-REVIEW WR-03): a refused file is removed from /sandbox/output ──


_OUT_NAME = "Q3 risk report.docx"  # passes _safe_out_filename, and needs quoting in a shell


def _run_handler_through_fake_sandbox(monkeypatch, verdict_stdout, *, rm_raises=False):
    """The real _ship_and_run against a fake session that records every command, with the
    produced file present in the harvested /sandbox/output copy."""
    import os

    import app.services.tools.render_template as td

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
    commands: list[str] = []

    class _FakeSession:
        def execute_command(self, cmd):
            commands.append(cmd)
            if cmd.startswith("rm ") and rm_raises:
                raise RuntimeError("sandbox went away")

            class _R:
                stdout = verdict_stdout if cmd.startswith("python ") else ""
                exit_code = 0

            return _R()

        def copy_to_runtime(self, local, remote):
            return None

        def copy_from_runtime(self, remote, local):
            with open(os.path.join(local, _OUT_NAME), "wb") as fp:
                fp.write(b"PK\x03\x04 produced")

    monkeypatch.setattr(td.sandbox_manager, "get_or_create", lambda *a, **k: _FakeSession())

    async def _passthrough_threadpool(fn, *a, **k):
        return fn(*a, **k)

    monkeypatch.setattr(td, "run_in_threadpool", _passthrough_threadpool)
    written: list[str] = []

    async def _fake_write(*a, **k):
        written.append(k["path"])
        return {
            "file_id": "f1", "path": k["path"], "version": 1,
            "size_bytes": 10, "mime_type": "application/octet-stream",
        }

    monkeypatch.setattr(td, "ws_write_file", _fake_write)

    async def _emit(*a, **k):
        return None

    ctx = _make_ctx(emit=_emit)
    args = {
        "field_map": {
            "scalars": {"project_name": {"value": "Meridian", "source_chunk_id": "chunk-1"}},
            "collections": {},
        },
        "retrieved_ids": ["chunk-1"],
        "out_filename": _OUT_NAME,
        "asset": {
            "asset_id": "user/_library/template.docx",
            "filename": "template.docx",
            "kind": "template",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
    }
    payload = json.loads(asyncio.run(td._handle_render_template(args, ctx)).result)
    return payload, commands, written


def _rm_commands(commands):
    return [c for c in commands if c.startswith("rm ")]


_EXPECTED_RM = "rm -f '/sandbox/output/Q3 risk report.docx'"


@pytest.mark.parametrize(
    "verdict, reason",
    [
        ({"rendered": True, "opened": True, "residual_clean": False,
          "residual_tags": [RECORD_PREFIX + "Body: {'value': 'Ann', 'source_chunk_id': 'c1'"]},
         "residual_tokens"),
        ({"rendered": True, "opened": False, "residual_clean": True, "residual_tags": []}, "integrity"),
        (None, "no_verdict"),
    ],
    ids=["residual", "integrity", "no-verdict"],
)
def test_handler_removes_a_refused_file_from_sandbox_output(monkeypatch, verdict, reason):
    stdout = json.dumps(verdict) if verdict is not None else "Traceback: driver died"
    payload, commands, written = _run_handler_through_fake_sandbox(monkeypatch, stdout)
    assert payload["status"] == "failed", payload
    assert payload["reason"] == reason, payload
    assert written == [], "a refused file must never be persisted"
    assert _rm_commands(commands) == [_EXPECTED_RM], commands


def test_handler_keeps_a_delivered_file(monkeypatch):
    verdict = {"rendered": True, "opened": True, "residual_clean": True, "residual_tags": []}
    payload, commands, written = _run_handler_through_fake_sandbox(monkeypatch, json.dumps(verdict))
    assert payload["status"] == "ok", payload
    assert written == ["/" + _OUT_NAME]
    assert _rm_commands(commands) == [], commands


def test_handler_refusal_reason_survives_a_failed_delete(monkeypatch, caplog):
    verdict = {"rendered": True, "opened": True, "residual_clean": False, "residual_tags": ["{{x}}"]}
    with caplog.at_level("WARNING", logger="app.services.tools.render_template"):
        payload, commands, _ = _run_handler_through_fake_sandbox(
            monkeypatch, json.dumps(verdict), rm_raises=True
        )
    assert payload["status"] == "failed" and payload["reason"] == "residual_tokens", payload
    assert _rm_commands(commands) == [_EXPECTED_RM]
    assert "could not remove" in caplog.text, caplog.text
