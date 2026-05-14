# backend/extractors/pymupdf_isolated.py
# Source: PyMuPDF 1.27 API verified in venv 2026-05-14; D-071-04
"""PyMuPDF AGPL fence child entrypoint — fitz imports ONLY happen here.

Invoked as: python -m extractors.pymupdf_isolated --mime application/pdf
Reads:      raw PDF/DOCX bytes on stdin
Writes:     ExtractedDocument JSON on stdout (b64 images embedded)
Errors:     non-zero exit code + last stderr line = caller-readable error.
"""
import argparse
import base64
import contextlib
import io
import json
import sys

import fitz  # PyMuPDF — AGPL-3.0; lives ONLY in this file.
from PIL import Image as PILImage


@contextlib.contextmanager
def _redirect_stdout_to_stderr():
    """Temporarily redirect Python's sys.stdout to sys.stderr.

    PyMuPDF's `page.find_tables()` (1.27.x) prints a marketing nudge
    ("Consider using the pymupdf_layout package…") directly to sys.stdout via
    a Python-level `print()` call. That string would otherwise corrupt the
    JSON-on-stdout IPC contract with the parent wrapper. Swapping the Python
    `sys.stdout` object catches Python-level writes; `sys.stderr.buffer` is
    used as the redirect target so the nudge surfaces as a diagnostic instead
    of being silently dropped.
    """
    saved = sys.stdout
    try:
        sys.stdout = sys.stderr
        yield
    finally:
        # Flush any buffered writes to stderr before restoring; protects the
        # JSON IPC contract from late-flush leaks.
        try:
            sys.stderr.flush()
        except Exception:
            pass
        sys.stdout = saved


def _extract(raw: bytes, mime: str) -> dict:
    doc = fitz.Document(stream=raw, filetype="pdf" if mime == "application/pdf" else "docx")
    try:
        # Text
        text_parts = [page.get_text() for page in doc]
        text = "\n\n".join(text_parts)

        # Tables (page.find_tables — PyMuPDF 1.23+; we have 1.27.2 in venv)
        tables = []
        for page_num, page in enumerate(doc, start=1):
            try:
                with _redirect_stdout_to_stderr():
                    tabs = page.find_tables()
                for ti, t in enumerate(tabs.tables or []):
                    rows_raw = t.extract()  # list[list[str|None]]
                    if not rows_raw or not rows_raw[0]:
                        continue
                    headers = [str(h or "") for h in rows_raw[0]]
                    rows = [[str(c or "") for c in r] for r in rows_raw[1:]]
                    tables.append({
                        "page": page_num,
                        "table_index": ti,
                        "headers": headers,
                        "rows": rows,
                        "bbox": {
                            "x0": t.bbox[0], "y0": t.bbox[1],
                            "x1": t.bbox[2], "y1": t.bbox[3],
                            "page": page_num,
                        },
                    })
            except Exception as e:
                # Per-page table failure does not blow up the whole extract.
                print(f"pymupdf: table extraction failed on page {page_num}: {e}", file=sys.stderr)

        # Images
        images = []
        global_idx = 0
        for page_num, page in enumerate(doc, start=1):
            for (xref, *_) in page.get_images(full=True):
                try:
                    info = doc.extract_image(xref)
                    raw_img = info["image"]
                    img = PILImage.open(io.BytesIO(raw_img)).convert("RGB")
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                    images.append({
                        "page": page_num,
                        "image_index": global_idx,
                        "b64_png": b64,
                        "width": info.get("width") or img.width,
                        "height": info.get("height") or img.height,
                        "bbox": None,
                    })
                    global_idx += 1
                except Exception as e:
                    print(f"pymupdf: image extraction failed (xref={xref}, page={page_num}): {e}", file=sys.stderr)

        return {
            "text": text,
            "tables": tables,
            "images": images,
            "table_extraction_error": None,
            "image_extraction_error": None,
            "full_markdown": None,
            "extractor_name": "pymupdf",
        }
    finally:
        doc.close()


def main() -> None:
    ap = argparse.ArgumentParser(prog="pymupdf_isolated")
    ap.add_argument("--mime", required=True)
    args = ap.parse_args()

    raw = sys.stdin.buffer.read()
    try:
        payload = _extract(raw, args.mime)
    except Exception as e:
        print(f"pymupdf_isolated: fatal: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(2)

    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
