"""Vision-as-OCR: turn pictures into indexable text (SEED-226 L1 + L2, and image uploads).

⭐ ONE MECHANISM, THREE USES. The product has always told users a scanned PDF "needs OCR
before it can be searched" (`documents.py::_EMPTY_TEXT_MESSAGES`) while shipping **no OCR
engine anywhere** — measured 2026-08-28 and again 2026-09-05: zero hits for tesseract /
pytesseract / easyocr / paddleocr / rapidocr across `requirements.txt`, `Dockerfile.sandbox`
and `docs/SANDBOX-PACKAGES.md`. This module closes that gap without adding one, because the
machinery already ships: `multimodal_service.describe_image` already sends images to a vision
LLM. What was missing was not a model — it was a *transcription* prompt and a route into it.

The three uses, all served by `transcribe_pages`:

  1. **An uploaded image** (`.png` / `.jpg` / …) becomes a searchable document.
  2. **L1 — a scanned PDF** with no text layer is rendered and transcribed.
  3. **L2 — a vector CAD drawing** whose text layer exists but is spatially meaningless is
     rendered whole-page and transcribed with the annotations attached to what they annotate.

⚠ WHY (3) MATTERS MORE THAN (2). SEED-226 measured a real AutoCAD floor plan: 2,822 line
segments, 2,799 drawing ops, and a text layer of 252 characters containing **exactly one
numeral** — run-together room names (`HALLHALL`, `BATHBATH`) and nothing else. The document
ingested `completed`, with no error and no "needs OCR" sentence. **A scan fails loudly; a
vector drawing succeeds and is wrong**, which is why the classifier below has a `drawing` arm
and not just an `empty` one.

⛔ WHAT THIS IS NOT. It is not a takeoff engine. Measurement comes from DXF
(`aspects/dxf.py`, Phase 220), which reads DIMENSION values the CAD software computed. This
module produces *text* — good text, attached to the right things, but inferred by a model.
Anything it yields is advisory, and `provenance()` exists so a caller can say so.

⚠ EVERY ENTRY POINT FAILS SOFT. A vision failure returns "" and leaves the caller's original
text untouched, so a document that would have ingested without this module still does.
"""
from __future__ import annotations

import base64
import io
import logging
from dataclasses import dataclass
from typing import Any, Literal

log = logging.getLogger(__name__)

# ── Thresholds ────────────────────────────────────────────────────────────────────────
#
# ⚠ TUNED AGAINST REAL FILES, NOT BENCHMARKS (SEED-226's probe, 2026-08-28). The real
#   drawing measured 252 text chars and 2,799 drawing ops on ONE page; an ordinary prose
#   PDF measures thousands of chars and a handful of ops. The gap between those is wide,
#   so these are deliberately conservative — a false NEGATIVE costs nothing (the document
#   ingests exactly as it does today), a false POSITIVE costs vision calls.

#: Below this many characters per page, a PDF has no usable text layer at all → a scan.
MIN_TEXT_CHARS_PER_PAGE = 100

#: At or above this many vector drawing operations per page, the page is geometry.
DRAWING_OPS_PER_PAGE = 400

#: A drawing page may carry SOME text (title block, room names) and still be a drawing.
#: Above this, treat it as a real document that happens to contain a figure.
DRAWING_MAX_TEXT_CHARS_PER_PAGE = 600

#: Render resolution. 200 DPI is the readability floor for dimension text on plots; higher
#: multiplies bytes without helping the model.
RENDER_DPI = 200

#: Longest edge of any image sent to the model, in pixels. Guards both cost and the
#: provider's own limits.
MAX_IMAGE_EDGE_PX = 2000

#: Hard ceiling on pages transcribed for one document, before the user's own cap applies.
#: A drawing SET is many pages and each is a paid call.
MAX_PAGES_HARD_CAP = 50

Deficit = Literal["scan", "drawing"]


@dataclass(frozen=True)
class PdfDeficit:
    """What a PDF's own pages say about whether its text layer is trustworthy."""

    kind: Deficit
    pages: int
    text_chars: int
    drawing_ops: int

    def as_provenance(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "pages": self.pages,
            "text_chars": self.text_chars,
            "drawing_ops": self.drawing_ops,
        }


# ── Prompts ───────────────────────────────────────────────────────────────────────────
#
# ⚠ THESE ARE TRANSCRIPTION PROMPTS, NOT DESCRIPTION PROMPTS, and that is the whole
#   difference from `describe_image`. SEED-006 measured that a caption preserves ~5% of a
#   figure's content; a caption of a document that is 100% figure is worse than nothing,
#   because a caption reads as knowledge. We ask for the text, verbatim, in reading order.

_PROMPT_SCAN = (
    "Transcribe ALL text visible in this image, verbatim and in natural reading order. "
    "Preserve headings, list structure and table rows (use tab-separated columns for tables). "
    "Do not summarise, do not describe the image, do not add commentary. "
    "If a word is illegible write [illegible]. Output only the transcription."
)

_PROMPT_DRAWING = (
    "This is a technical or architectural drawing. Transcribe every piece of text on it and "
    "KEEP EACH LABEL ATTACHED TO WHAT IT LABELS. Report, in this order and only where present:\n"
    "1. Title block: drawing title, drawing number, revision, scale, date, project.\n"
    "2. Each labelled space or element, with the dimensions written next to it "
    "(for example: 'BEDROOM 1 - 3600 x 4100').\n"
    "3. Legend and key entries, one per line, code then meaning.\n"
    "4. Schedule or table content, as tab-separated rows.\n"
    "5. Annotations, callouts and notes, verbatim.\n"
    "Report only what is written on the drawing. Never estimate or infer a dimension that is "
    "not printed. If a value is unreadable write [illegible]. Output only the transcription."
)

_PROMPTS: dict[str, str] = {"scan": _PROMPT_SCAN, "drawing": _PROMPT_DRAWING}


def _prompt_for(kind: str) -> str:
    return _PROMPTS.get(kind, _PROMPT_SCAN)


# ── Rendering ─────────────────────────────────────────────────────────────────────────


def image_to_png_b64(raw: bytes, max_edge_px: int = MAX_IMAGE_EDGE_PX) -> str:
    """Normalise ANY uploaded image to a base64 PNG the vision path can send.

    Handles the formats Pillow reads (PNG/JPEG/WEBP/TIFF/BMP/GIF), honours EXIF rotation so
    a phone photo is not transcribed sideways, flattens transparency onto white (a model
    reads black-on-transparent as black-on-black), and downscales the long edge.

    Raises ValueError if the bytes are not a readable image.
    """
    from PIL import Image, ImageOps  # noqa: PLC0415

    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception as exc:  # noqa: BLE001 — any Pillow failure is "not a readable image"
        raise ValueError(f"unreadable image: {exc}") from exc

    img = ImageOps.exif_transpose(img) or img

    if img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        flat = Image.new("RGB", rgba.size, (255, 255, 255))
        flat.paste(rgba, mask=rgba.split()[-1])
        img = flat
    elif img.mode != "RGB":
        img = img.convert("RGB")

    longest = max(img.size)
    if longest > max_edge_px:
        scale = max_edge_px / longest
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))))

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def render_pdf_pages_b64(
    raw: bytes,
    max_pages: int,
    dpi: int = RENDER_DPI,
    max_edge_px: int = MAX_IMAGE_EDGE_PX,
) -> list[str]:
    """Render the first `max_pages` pages of a PDF to base64 PNGs.

    Returns [] rather than raising when the PDF cannot be opened — the caller keeps whatever
    text it already had.
    """
    if max_pages <= 0:
        return []
    try:
        import pymupdf  # noqa: PLC0415
    except ImportError:  # pragma: no cover - pymupdf is a committed dependency
        log.warning("pymupdf unavailable; cannot render PDF pages for vision transcription")
        return []

    out: list[str] = []
    try:
        with pymupdf.open(stream=raw, filetype="pdf") as doc:
            zoom = dpi / 72.0
            for page in doc.pages(0, min(len(doc), max_pages)):
                pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
                # Re-normalise through Pillow so the edge cap and PNG settings are applied
                # by ONE code path, shared with uploaded images.
                out.append(image_to_png_b64(pix.tobytes("png"), max_edge_px=max_edge_px))
    except Exception:  # noqa: BLE001 — a render failure must never fail an ingest
        log.warning("PDF page render for vision transcription failed", exc_info=True)
        return out
    return out


# ── Classification ────────────────────────────────────────────────────────────────────


def classify_pdf_deficit(raw: bytes, extracted_text: str = "") -> PdfDeficit | None:
    """Decide whether a PDF's extracted text can be trusted to represent the document.

    Returns None when the text layer is fine (the overwhelmingly common case — this must be
    cheap and must not fire on ordinary documents), otherwise a `PdfDeficit` naming which of
    the two failure shapes it is.

    ⚠ THE TEXT MEASURED IS THE PAGES' OWN, not the caller's `extracted_text`. A caller may
      have already fallen back between engines; what decides "is there a text layer" is the
      file. `extracted_text` is used only as a floor, so a document whose text the caller
      read fine is never re-transcribed.
    """
    try:
        import pymupdf  # noqa: PLC0415
    except ImportError:  # pragma: no cover
        return None

    try:
        with pymupdf.open(stream=raw, filetype="pdf") as doc:
            pages = len(doc)
            if pages == 0:
                return None
            text_chars = 0
            drawing_ops = 0
            for page in doc:
                text_chars += len(page.get_text().strip())
                try:
                    drawing_ops += len(page.get_drawings())
                except Exception:  # noqa: BLE001 — geometry is optional evidence
                    pass
    except Exception:  # noqa: BLE001 — an unopenable PDF is not this function's problem
        return None

    # The caller may have read more than the pages report (a different engine, an embedded
    # text stream). Trust the larger number — never re-transcribe a readable document.
    text_chars = max(text_chars, len(extracted_text.strip()))

    per_page_text = text_chars / pages
    per_page_ops = drawing_ops / pages

    if per_page_text < MIN_TEXT_CHARS_PER_PAGE:
        # No usable text layer at all. Geometry present or not, the pixels are the document.
        kind: Deficit = "drawing" if per_page_ops >= DRAWING_OPS_PER_PAGE else "scan"
        return PdfDeficit(kind, pages, text_chars, drawing_ops)

    if per_page_ops >= DRAWING_OPS_PER_PAGE and per_page_text < DRAWING_MAX_TEXT_CHARS_PER_PAGE:
        # ⚠ THE DANGEROUS CASE. Text extracted, nothing errored, and the numbers a reader
        #   needs are line-art glyphs the text layer never saw.
        return PdfDeficit("drawing", pages, text_chars, drawing_ops)

    return None


# ── Transcription ─────────────────────────────────────────────────────────────────────


def _vision_client(app_settings: Any):
    from openai import OpenAI  # noqa: PLC0415

    return OpenAI(
        api_key=getattr(app_settings, "llm_api_key", None),
        base_url=getattr(app_settings, "llm_base_url", None) or None,
    )


def _transcribe_one(b64_png: str, kind: str, app_settings: Any, client) -> str:
    from app.config import settings as env_settings  # noqa: PLC0415

    model = env_settings.vision_model or getattr(app_settings, "llm_model", None)
    resp = client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": _prompt_for(kind)},
                {
                    "type": "image_url",
                    # ⚠ `detail: high`, unlike describe_image's `low`. A caption tolerates a
                    #   downsampled image; a transcription of a dimension string does not.
                    "image_url": {"url": f"data:image/png;base64,{b64_png}", "detail": "high"},
                },
            ],
        }],
        max_tokens=4096,
        stream=False,
    )
    return (resp.choices[0].message.content or "").strip()


def transcribe_pages(
    pages_b64: list[str],
    kind: str,
    app_settings: Any,
    client=None,
) -> str:
    """Transcribe rendered pages to text. Returns "" on total failure — never raises.

    Pages are transcribed independently and joined with a page marker, so one page failing
    costs that page and not the document.
    """
    if not pages_b64:
        return ""

    own_client = client is None
    try:
        client = client or _vision_client(app_settings)
    except Exception:  # noqa: BLE001
        log.warning("could not construct vision client for transcription", exc_info=True)
        return ""

    parts: list[str] = []
    multi = len(pages_b64) > 1
    for idx, b64 in enumerate(pages_b64, 1):
        try:
            body = _transcribe_one(b64, kind, app_settings, client)
        except Exception:  # noqa: BLE001 — one page must not condemn the rest
            log.warning("vision transcription failed on page %d", idx, exc_info=True)
            continue
        if not body:
            continue
        parts.append(f"## Page {idx}\n\n{body}" if multi else body)

    if own_client:
        try:
            close = getattr(client, "close", None)
            if callable(close):
                close()
        except Exception:  # noqa: BLE001
            pass

    return "\n\n".join(parts)


def page_budget(app_settings: Any, pages: int) -> int:
    """How many pages may be transcribed for one document.

    ⚠ REUSES THE CAP THAT ALREADY EXISTS rather than inventing a second one.
      `multimodal_max_vision_calls` (user_settings, DB-backed, default 100) is the operator's
      existing control over vision spend; a transcription is a vision call like any other.
      SEED-227 tracks that this knob is surfaced in no frontend file — that stays one problem,
      not two.
    """
    cap = int(getattr(app_settings, "multimodal_max_vision_calls", 100) or 100)
    return max(0, min(pages, cap, MAX_PAGES_HARD_CAP))


def provenance(kind: str, pages_transcribed: int, deficit: PdfDeficit | None = None) -> dict[str, Any]:
    """The record stamped on a document whose text a model read off pixels.

    ⚠ THIS IS NOT DECORATION. Text produced here is *inferred*, and every downstream reader —
      retrieval, the detail panel, a BOQ — is entitled to know that before quoting a number
      from it. A transcription that cannot be told apart from a real text layer is the
      failure SEED-226 exists to prevent, one layer up.
    """
    rec: dict[str, Any] = {
        "engine": "vision",
        "kind": kind,
        "pages_transcribed": pages_transcribed,
        "advisory": True,
    }
    if deficit is not None:
        rec["detected"] = deficit.as_provenance()
    return rec
