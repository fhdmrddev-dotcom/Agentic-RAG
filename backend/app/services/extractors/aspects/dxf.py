"""DXF CAD Takeoff & Entity Extraction Aspect (Phase 220, TAKEOFF-01).

Extracts modelspace entities from CAD .dxf files:
- Blocks (`INSERT`): exact item counts.
- Measured Dimensions (`DIMENSION`): CAD-computed distances.
- Specification Callouts (`MULTILEADER`, `MTEXT`, `TEXT`): cleaned engineering annotations.
- Raw Line Lengths (`LINE`): layer-aggregated lengths (order-of-magnitude, strictly not wall volume).
- Units (`$INSUNITS`): unit resolution with honest refusal for unitless ($INSUNITS=0) drawings.
"""
from __future__ import annotations

import io
import math
import re
from collections import Counter, defaultdict
from typing import Any

# $INSUNITS mapping. 0 is UNITLESS — a refusal case, not a default.
UNITS: dict[int, tuple[str, float | None]] = {
    0: ("unitless", None),
    1: ("inches", 0.0254),
    2: ("feet", 0.3048),
    4: ("mm", 0.001),
    5: ("cm", 0.01),
    6: ("m", 1.0),
}

# CAD formatting codes: \A1; \W1.15; \H0.7x; \P \S1/2; {...} %%C
_FMT_RE = re.compile(r"\\[A-Za-z]\d*(?:\.\d+)?[x;]?|\\P|\\S[^;]*;|[{}]|%%[cCdDpP]")


def clean_cad_text(text: str | None) -> str:
    """Strip AutoCAD MTEXT formatting tags and normalize whitespace."""
    if not text:
        return ""
    return " ".join(_FMT_RE.sub(" ", text).split())


def extract_dxf_takeoff(raw_bytes: bytes, filename: str = "") -> dict[str, Any]:
    """Parse a DXF file and extract structured CAD takeoff entities.

    Raises ValueError if the DXF is malformed or unreadable.
    """
    import ezdxf

    try:
        # ezdxf.read accepts a text stream
        text_stream = io.StringIO(raw_bytes.decode("utf-8", errors="replace"))
        doc = ezdxf.read(text_stream)
    except Exception as exc:
        raise ValueError(f"Failed to parse DXF file {filename or 'unnamed'}: {exc}") from exc

    msp = doc.modelspace()
    unit_code = getattr(doc, "units", 0)
    unit_name, to_m = UNITS.get(unit_code, (f"code {unit_code}", None))

    is_refused = unit_code == 0 or to_m is None
    refusal_reason = (
        "Refusing to convert lengths: this drawing declares NO units ($INSUNITS=0)."
        if is_refused
        else None
    )

    # 1. Measured Dimensions
    dims: list[float] = []
    for entity in msp.query("DIMENSION"):
        try:
            m = entity.get_measurement()
            if isinstance(m, (int, float)) and not math.isnan(m):
                dims.append(float(m))
        except Exception:
            continue

    # 2. Counted Blocks (INSERT)
    block_counter: Counter[str] = Counter()
    blocks_by_layer: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for entity in msp.query("INSERT"):
        bname = entity.dxf.name if hasattr(entity.dxf, "name") else "unknown_block"
        layer = entity.dxf.layer if hasattr(entity.dxf, "layer") else "0"
        block_counter[bname] += 1
        blocks_by_layer[layer][bname] += 1

    # 3. Layer Line Lengths (ORDER-OF-MAGNITUDE only)
    length_by_layer: dict[str, float] = defaultdict(float)
    lines_by_layer: Counter[str] = Counter()
    for entity in msp.query("LINE"):
        try:
            s, t = entity.dxf.start, entity.dxf.end
            layer = entity.dxf.layer if hasattr(entity.dxf, "layer") else "0"
            dist = math.dist((s.x, s.y), (t.x, t.y))
            length_by_layer[layer] += dist
            lines_by_layer[layer] += 1
        except Exception:
            continue

    # 4. Specification Callouts (MULTILEADER, MTEXT, TEXT)
    specs: list[str] = []
    seen_specs: set[str] = set()

    for entity in msp.query("MULTILEADER"):
        txt = None
        try:
            if getattr(entity, "context", None) and entity.context.mtext:
                txt = entity.context.mtext.default_content
        except Exception:
            pass
        if txt:
            c = clean_cad_text(txt)
            if c and c not in seen_specs:
                specs.append(c)
                seen_specs.add(c)

    for entity in msp.query("MTEXT"):
        try:
            c = clean_cad_text(entity.text)
            if c and c not in seen_specs:
                specs.append(c)
                seen_specs.add(c)
        except Exception:
            continue

    for entity in msp.query("TEXT"):
        try:
            c = clean_cad_text(entity.dxf.text)
            if c and c not in seen_specs:
                specs.append(c)
                seen_specs.add(c)
        except Exception:
            continue

    # Generate searchable text summary for RAG indexing
    summary_lines = [
        f"# CAD Drawing Takeoff Summary: {filename or 'Drawing'}",
        f"- Units: {unit_name} (INSUNITS code {unit_code})",
        f"- Total Modelspace Entities: {len(msp)}",
    ]
    if is_refused:
        summary_lines.append(f"- Warning: {refusal_reason}")

    if block_counter:
        summary_lines.append("\n## Counted Block Items (INSERT)")
        for bname, count in block_counter.most_common():
            summary_lines.append(f"- `{bname}`: {count} count")

    if dims:
        summary_lines.append(f"\n## Measured Dimensions ({len(dims)} total)")
        summary_lines.append(f"- Dimensions sample: {', '.join(f'{d:.2f}' for d in dims[:20])}")

    if specs:
        summary_lines.append(f"\n## Specification Annotations ({len(specs)} callouts)")
        for s in specs[:50]:
            summary_lines.append(f"- {s}")

    text_summary = "\n".join(summary_lines)

    return {
        "units": unit_name,
        "to_m": to_m,
        "insunits_code": unit_code,
        "refused": is_refused,
        "refusal_reason": refusal_reason,
        "blocks": dict(block_counter),
        "blocks_by_layer": {k: dict(v) for k, v in blocks_by_layer.items()},
        "dimensions": dims,
        "specs": specs,
        "length_by_layer": dict(length_by_layer),
        "lines_by_layer": dict(lines_by_layer),
        "entity_total": len(msp),
        "text_summary": text_summary,
    }
