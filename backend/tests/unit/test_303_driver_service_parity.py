"""Phase 303 (D-10 / SC#4): the driver copy and the service copy of the Word fill code agree.

There are two copies of the same functions:

* ``backend/app/services/tools/render_template.py::_RENDER_DRIVER_SRC`` — a self-contained
  script shipped INTO the sealed sandbox. It cannot import ``app.*`` (the container has no
  backend package on its path), so it INLINES ``_cell``, ``_replace_in_paragraph``,
  ``run_replace_docx`` and ``residual_tags_in``.
* ``backend/app/services/template_render_service.py`` — the in-app, typed copy that the
  backend and the tests call directly.

Until Phase 303 they were held together by comments alone ("a VERBATIM mirror"), and they
drift because a fix lands in the file someone happens to be reading. BUG-261022-01 needed
the same change in both. This file is the D-10 pin: it drives both copies over the SAME
fixtures and fails if either one changes alone.

The driver copy is loaded by ``exec`` with a ``__name__`` that is never ``"__main__"``, so
its ``main()`` does not run (the pattern test_291_pdf_fill_driver.py uses).
"""

from __future__ import annotations

import pytest
from docx import Document

import app.services.template_render_service as service
import app.services.tools.render_template as render_template_module
from app.services.tools.render_template import _RENDER_DRIVER_SRC

REPR_TEXT = "{'value': 'Ann', 'source_chunk_id': 'c1'}"


@pytest.fixture()
def driver() -> dict:
    ns: dict = {"__name__": "render_driver_under_test"}
    exec(compile(_RENDER_DRIVER_SRC, "<render_driver>", "exec"), ns)
    return ns


# ── fake paragraph (test_template_render.py's run harness) ───────────────────


class _Run:
    def __init__(self, text):
        self.text = text


class _Para:
    def __init__(self, run_texts):
        self.runs = [_Run(t) for t in run_texts]

    @property
    def text(self):
        return "".join(r.text for r in self.runs)


BACKSLASH_VALUE = r"x\1y\g<0>z\\"

_CASES = [
    ("tight", ["X: {{name}}"], {"name": "Ann"}, "X: Ann"),
    ("spaced", ["X: {{ name }}"], {"name": "Ann"}, "X: Ann"),
    ("wide", ["X: {{   name   }}"], {"name": "Ann"}, "X: Ann"),
    ("value", ["X: {{ name.value }}"], {"name": "Ann"}, "X: Ann"),
    ("unknown", ["X: {{ nope }}"], {"name": "Ann"}, "X: "),
    ("run-split-tight", ["X: {{na", "me}}"], {"name": "Ann"}, "X: Ann"),
    ("run-split-spaced", ["X: {{ na", "me }}"], {"name": "Ann"}, "X: Ann"),
    ("backslash", ["X: {{ name }}"], {"name": BACKSLASH_VALUE}, "X: " + BACKSLASH_VALUE),
]


@pytest.mark.parametrize(
    "runs, scalars, expected",
    [c[1:] for c in _CASES],
    ids=[c[0] for c in _CASES],
)
def test_replace_in_paragraph_parity(driver, runs, scalars, expected):
    d_para = _Para(runs)
    s_para = _Para(runs)
    driver["_replace_in_paragraph"](d_para, dict(scalars))
    service._replace_in_paragraph(s_para, dict(scalars))
    assert d_para.text == s_para.text, f"driver {d_para.text!r} != service {s_para.text!r}"
    assert d_para.text == expected


def test_cell_parity(driver):
    cited = {"value": "Ann", "source_chunk_id": "c1", "source_doc": "d.pdf", "source_page": 2}
    d_cell = driver["_cell"](dict(cited))
    s_cell = service._cell(dict(cited))
    # Non-vacuity first: both copies still build a dict (so .value / if / == behave).
    assert isinstance(d_cell, dict) and isinstance(s_cell, dict)
    assert str(d_cell) == str(s_cell) == "Ann"
    assert str(driver["_cell"](None)) == str(service._cell(None)) == ""
    assert "'source_chunk_id':" in repr(d_cell)
    assert "'source_chunk_id':" in repr(s_cell)
    assert d_cell == s_cell == cited
    assert not hasattr(d_cell, "__html__")
    assert not hasattr(s_cell, "__html__")


def _repr_everywhere(path):
    d = Document()
    sec = d.sections[0]
    sec.header.paragraphs[0].text = "Header: " + REPR_TEXT
    sec.footer.paragraphs[0].text = "Footer: " + REPR_TEXT
    sec.different_first_page_header_footer = True
    sec.first_page_header.paragraphs[0].text = "FirstHeader: " + REPR_TEXT
    t = d.add_table(rows=1, cols=1)
    t.cell(0, 0).text = "Cell: plain"
    inner = t.cell(0, 0).add_table(rows=1, cols=1)
    inner.cell(0, 0).text = "Nested: " + REPR_TEXT
    d.save(str(path))
    return path


def test_residual_scan_parity(driver, tmp_path):
    p = _repr_everywhere(tmp_path / "repr.docx")
    d_hits = driver["residual_tags_in"](str(p), "docx")
    s_hits = service.residual_tags_in(str(p), "docx")
    assert d_hits == s_hits, f"driver {d_hits} != service {s_hits}"
    assert len(d_hits) >= 4, d_hits
    assert all(h.startswith("record text: ") for h in d_hits), d_hits


def _texts(path):
    d = Document(str(path))
    out: list[str] = []

    def paras(container):
        out.extend(p.text for p in container.paragraphs)
        for t in container.tables:
            for row in t.rows:
                for c in row.cells:
                    paras(c)

    paras(d)
    for s in d.sections:
        for hf in (s.header, s.first_page_header, s.even_page_header, s.footer, s.first_page_footer, s.even_page_footer):
            if not hf.is_linked_to_previous:
                paras(hf)
    return [t for t in out if t]


def test_run_replace_docx_parity(driver, tmp_path):
    d = Document()
    d.add_paragraph("Body: {{ name }}")
    t = d.add_table(rows=1, cols=1)
    t.cell(0, 0).text = "Cell: x"
    t.cell(0, 0).add_table(rows=1, cols=1).cell(0, 0).text = "Nested: {{ name }}"
    sec = d.sections[0]
    sec.different_first_page_header_footer = True
    sec.first_page_header.paragraphs[0].text = "FirstHeader: {{ name }}"
    tpl = tmp_path / "tpl.docx"
    d.save(str(tpl))

    d_out = tmp_path / "driver.docx"
    s_out = tmp_path / "service.docx"
    driver["run_replace_docx"](str(tpl), {"name": "Ann"}, str(d_out))
    service.run_replace_docx(str(tpl), {"name": "Ann"}, str(s_out))
    d_texts = _texts(d_out)
    s_texts = _texts(s_out)
    assert d_texts == s_texts
    assert d_texts == ["Body: Ann", "Cell: x", "Nested: Ann", "FirstHeader: Ann"], d_texts


def test_record_text_prefix_parity(driver):
    module_prefix = getattr(render_template_module, "_RECORD_TEXT_PREFIX", None)
    service_prefix = getattr(service, "_RECORD_TEXT_PREFIX", None)
    driver_prefix = driver.get("_RECORD_TEXT_PREFIX")
    assert module_prefix == service_prefix == driver_prefix == "record text: "
