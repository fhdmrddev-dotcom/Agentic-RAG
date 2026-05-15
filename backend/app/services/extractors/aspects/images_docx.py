"""DOCX image-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-02).

`inline_shapes_docx` wraps the existing python-docx inline-shapes path.
`zip_xpath_docx` is a VERBATIM PORT of Docling's MsWordDocumentBackend
XPath algorithm — closes RAG-MM-LIFT-02 (floating/anchored pictures that
inline_shapes misses).

Source for the port (lines cited per phase plan):
  backend/venv/Lib/site-packages/docling/backend/msword_backend.py
  - lines 58-69:    _BLIP_NAMESPACES namespace map
  - lines 78-83:    blip_xpath_expr `.//a:blip` + vml_imagedata_xpath_expr `.//v:imagedata`
  - lines 2122-2127: rel-ID dereference for a:blip via `{...relationships}embed`
  - lines 2181-2186: rel-ID dereference for v:imagedata via `{...relationships}id`
"""
from __future__ import annotations

import base64
import io
import logging
import zipfile

from app.services.extraction_service import ImageData

log = logging.getLogger(__name__)


# Verbatim from MsWordDocumentBackend._BLIP_NAMESPACES (msword_backend.py:58-69).
_DOCX_BLIP_NAMESPACES = {
    "a":   "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r":   "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "w":   "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "wp":  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "mc":  "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "v":   "urn:schemas-microsoft-com:vml",
    "wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
    "w10": "urn:schemas-microsoft-com:office:word",
    "a14": "http://schemas.microsoft.com/office/drawing/2010/main",
    "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
}

# DrawingML `a:blip` embeds use `{...relationships}embed`
# (msword_backend.py:2122-2127).
_BLIP_EMBED_ATTR = (
    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"
)
# VML `v:imagedata` use `{...relationships}id` (msword_backend.py:2181-2186).
_VML_IMAGEDATA_ID = (
    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
)

# Plan T-071.2-05-03 mitigation — defense-in-depth against XML entity
# expansion (billion-laughs). lxml is hardened by default since 3.x, but
# we still construct a hardened parser to make the invariant explicit.
def _hardened_parser():
    from lxml import etree  # noqa: PLC0415
    return etree.XMLParser(resolve_entities=False, no_network=True)


def _read_rels(zf: zipfile.ZipFile, part_path: str) -> dict[str, str]:
    """Return the {rId: Target} mapping from `part_path`'s sibling .rels file.

    Example: part_path='word/document.xml' → reads 'word/_rels/document.xml.rels'.
    """
    from lxml import etree  # noqa: PLC0415

    if "/" in part_path:
        dirname, base = part_path.rsplit("/", 1)
        rels_path = f"{dirname}/_rels/{base}.rels"
    else:
        rels_path = f"_rels/{part_path}.rels"

    if rels_path not in zf.namelist():
        return {}
    try:
        rels_bytes = zf.read(rels_path)
        root = etree.fromstring(rels_bytes, parser=_hardened_parser())
    except Exception as exc:  # noqa: BLE001
        log.debug("zip_xpath_docx: failed to read rels %s: %s", rels_path, exc)
        return {}

    out: dict[str, str] = {}
    ns_rel = "http://schemas.openxmlformats.org/package/2006/relationships"
    for rel in root.iter(f"{{{ns_rel}}}Relationship"):
        rid = rel.get("Id")
        target = rel.get("Target")
        if rid and target:
            out[rid] = target
    return out


def _resolve_media_path(part_path: str, target: str) -> str:
    """Resolve a relationship Target (relative path) to the ZIP entry path.

    DOCX rels Targets are relative to the part's directory. For
    word/document.xml.rels, Target='media/image1.png' → 'word/media/image1.png'.
    """
    if "/" in part_path:
        dirname = part_path.rsplit("/", 1)[0]
    else:
        dirname = ""
    # Strip leading "./" or "/"
    target = target.lstrip("/").removeprefix("./")
    if dirname:
        return f"{dirname}/{target}"
    return target


def inline_shapes_docx(raw: bytes) -> list[ImageData]:
    """Legacy python-docx inline-shapes path — wraps
    multimodal_service.extract_docx_images.

    LIMITATION: only finds `<wp:inline>` shapes; misses floating
    `<wp:anchor>` pictures (the very thing RAG-MM-LIFT-02 closes).
    """
    from app.services.multimodal_service import extract_docx_images  # noqa: PLC0415

    dicts = extract_docx_images(raw)
    return [ImageData(**d) for d in dicts]


def zip_xpath_docx(raw: bytes, min_px: int = 50) -> list[ImageData]:
    """VERBATIM port of Docling's MsWordDocumentBackend XPath image algorithm.

    Walks the DOCX as a ZIP, parses `word/document.xml` plus every
    `word/header*.xml` and `word/footer*.xml`, runs the XPaths
    `.//a:blip` (DrawingML) and `.//v:imagedata` (VML legacy) over each
    part. For each match, dereferences the rel-ID to a media path via
    the part's .rels file, reads the bytes from the ZIP, and produces
    an ImageData.

    Dedups by media path — same `word/media/image1.png` referenced
    twice yields ONE ImageData.

    RAG-MM-LIFT-02 closure: this correctly handles floating/anchored
    pictures (`<wp:anchor>` containing `<a:blip>`) that python-docx's
    `inline_shapes` collection skips.

    `min_px=50` size filter matches the existing
    `multimodal_service.extract_docx_images` behavior.
    """
    from lxml import etree  # noqa: PLC0415
    from PIL import Image as PILImage  # noqa: PLC0415

    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile as exc:
        log.warning("zip_xpath_docx: not a valid DOCX ZIP: %s", exc)
        return []

    try:
        # Collect candidate parts: document.xml + all header*.xml + all footer*.xml.
        candidate_parts: list[str] = []
        for name in zf.namelist():
            if name == "word/document.xml":
                candidate_parts.append(name)
            elif name.startswith("word/header") and name.endswith(".xml"):
                candidate_parts.append(name)
            elif name.startswith("word/footer") and name.endswith(".xml"):
                candidate_parts.append(name)

        seen_media: set[str] = set()
        results: list[ImageData] = []

        for part in candidate_parts:
            try:
                part_bytes = zf.read(part)
                root = etree.fromstring(part_bytes, parser=_hardened_parser())
            except Exception as exc:  # noqa: BLE001
                log.debug("zip_xpath_docx: failed to parse %s: %s", part, exc)
                continue

            rels = _read_rels(zf, part)

            # DrawingML blips (msword_backend.py:78-83)
            blips = root.iterfind(".//a:blip", _DOCX_BLIP_NAMESPACES)
            # VML imagedata (msword_backend.py:78-83)
            vml = root.iterfind(".//v:imagedata", _DOCX_BLIP_NAMESPACES)

            for blip in blips:
                rid = blip.get(_BLIP_EMBED_ATTR)
                if not rid or rid not in rels:
                    continue
                media_path = _resolve_media_path(part, rels[rid])
                if media_path in seen_media:
                    continue  # dedup
                if media_path not in zf.namelist():
                    continue
                seen_media.add(media_path)
                im = _load_media_as_image_data(
                    zf, media_path, image_index=len(results), min_px=min_px
                )
                if im is not None:
                    results.append(im)

            for vml_img in vml:
                rid = vml_img.get(_VML_IMAGEDATA_ID)
                if not rid or rid not in rels:
                    continue
                media_path = _resolve_media_path(part, rels[rid])
                if media_path in seen_media:
                    continue
                if media_path not in zf.namelist():
                    continue
                seen_media.add(media_path)
                im = _load_media_as_image_data(
                    zf, media_path, image_index=len(results), min_px=min_px
                )
                if im is not None:
                    results.append(im)

        return results
    finally:
        zf.close()


def _load_media_as_image_data(
    zf: zipfile.ZipFile,
    media_path: str,
    *,
    image_index: int,
    min_px: int,
) -> ImageData | None:
    """Read media bytes from ZIP, decode via Pillow, apply size filter, b64-encode.

    DOCX has no stable page numbers — page=None; rendering coordinates
    (bbox) are renderer-dependent — bbox=None (out of scope per
    RESEARCH-COMPLETENESS Part A).
    """
    from PIL import Image as PILImage  # noqa: PLC0415

    try:
        img_bytes = zf.read(media_path)
    except Exception as exc:  # noqa: BLE001
        log.debug("zip_xpath_docx: failed to read media %s: %s", media_path, exc)
        return None
    try:
        pil_img = PILImage.open(io.BytesIO(img_bytes))
        # Force-load the image (Pillow is lazy) so dimensions resolve.
        pil_img.load()
    except Exception as exc:  # noqa: BLE001
        log.debug("zip_xpath_docx: PIL refused %s: %s", media_path, exc)
        return None

    if pil_img.width < min_px or pil_img.height < min_px:
        return None

    try:
        buf = io.BytesIO()
        pil_img.convert("RGB").save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception as exc:  # noqa: BLE001
        log.debug("zip_xpath_docx: PNG re-encode failed for %s: %s", media_path, exc)
        return None

    return ImageData(
        page=None,            # Word has no stable page numbers
        image_index=image_index,
        b64_png=b64,
        width=pil_img.width,
        height=pil_img.height,
        bbox=None,            # Renderer-dependent — out of scope
    )
