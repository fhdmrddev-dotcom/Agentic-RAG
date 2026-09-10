"""Read a Google Sheet as CELLS.

── ⚠ THIS EXISTS BECAUSE `read_file` ON A SHEET RETURNS A PDF ─────────────────────────
`GoogleDriveSourceAdapter.read_file` exports a Google-native Sheet to PDF before
downloading it, so the connector's Drive `read_file` hands the model a binary it then
refuses to decode. For an app whose agent runs pandas in a sandbox that is close to
useless: **the single highest-value gap on the Google surface** (operator, 2026-08-31).
A Sheets read returns rows of values the model can reason about and the sandbox can load.

⛔ READS ONLY — `spreadsheets.readonly`. No append, no update, no create; those are a
different scope and a decision explicitly deferred ("reads first, decide after").
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.services.google._http import GoogleReadError, get_json

CAPABILITY = "sheets_read"
API = "https://sheets.googleapis.com/v4/spreadsheets"

#: A grid big enough to be an answer, small enough not to be a context bomb. Sheets
#: returns ragged rows (trailing empties are omitted), so this counts CELLS RETURNED,
#: which is the thing that actually reaches the model.
_MAX_CELLS = 20_000

__all__ = ["list_sheet_tabs", "read_sheet", "CAPABILITY"]


async def list_sheet_tabs(connection_id: str | UUID, spreadsheet_id: str) -> dict[str, Any]:
    """The spreadsheet's title and every tab in it, with each tab's real extent.

    ⚠ THIS IS THE REACHABILITY HALF OF `read_sheet` AND IS NOT OPTIONAL. `read_sheet`
    takes an A1 range like `Sheet1!A1:D50`, and a model that has never seen the tab names
    can only guess `Sheet1` — which is wrong the moment anyone renamed a tab. Without this
    tool the other one is a coin flip.
    """
    sid = str(spreadsheet_id or "").strip()
    if not sid:
        raise GoogleReadError("list_sheet_tabs needs a spreadsheet id and none was supplied")
    data = await get_json(
        CAPABILITY,
        connection_id,
        f"{API}/{sid}",
        {"fields": "properties(title),sheets(properties(title,sheetId,gridProperties))"},
        what="list_sheet_tabs",
    )
    tabs = []
    for sheet in data.get("sheets") or []:
        props = (sheet or {}).get("properties") or {}
        grid = props.get("gridProperties") or {}
        tabs.append({
            "title": props.get("title"),
            "sheet_id": props.get("sheetId"),
            "rows": grid.get("rowCount"),
            "columns": grid.get("columnCount"),
        })
    return {
        "spreadsheet_id": sid,
        "title": ((data.get("properties") or {}).get("title")),
        "tabs": tabs,
    }


async def read_sheet(
    connection_id: str | UUID,
    spreadsheet_id: str,
    a1_range: str | None = None,
) -> dict[str, Any]:
    """Return the values in ``a1_range`` (or the first tab) as a list of rows.

    ⚠ ROWS ARE RAGGED AND THAT IS GOOGLE'S SHAPE, NOT A BUG. `values.get` omits trailing
    empty cells, so row 1 may have 5 entries and row 2 only 2. It is reported rather than
    padded: padding invents a value the sheet does not contain, and the width is stated
    as `columns` so a caller that needs a rectangle can build one.
    """
    sid = str(spreadsheet_id or "").strip()
    if not sid:
        raise GoogleReadError("read_sheet needs a spreadsheet id and none was supplied")

    rng = str(a1_range or "").strip()
    if rng:
        data = await get_json(
            CAPABILITY,
            connection_id,
            f"{API}/{sid}/values/{rng}",
            {"majorDimension": "ROWS"},
            what="read_sheet",
        )
    else:
        # No range given: read the FIRST tab whole, by name. `values/{title}` with no cell
        # span is Sheets' own "the used extent of that tab" — never the literal grid, which
        # for a default sheet is 1000x26 of mostly nothing.
        tabs = await list_sheet_tabs(connection_id, sid)
        first = next((t["title"] for t in tabs["tabs"] if t.get("title")), None)
        if not first:
            raise GoogleReadError(f"spreadsheet {sid} has no readable tab")
        rng = first
        data = await get_json(
            CAPABILITY,
            connection_id,
            f"{API}/{sid}/values/{rng}",
            {"majorDimension": "ROWS"},
            what="read_sheet",
        )

    rows: list[list[Any]] = data.get("values") or []
    cells = sum(len(r) for r in rows)
    truncated = False
    if cells > _MAX_CELLS:
        kept: list[list[Any]] = []
        running = 0
        for row in rows:
            if running + len(row) > _MAX_CELLS:
                break
            kept.append(row)
            running += len(row)
        rows, truncated = kept, True

    return {
        "spreadsheet_id": sid,
        "range": data.get("range") or rng,
        "rows": rows,
        "row_count": len(rows),
        "columns": max((len(r) for r in rows), default=0),
        "truncated": truncated,
        "note": (
            "Rows are ragged — Sheets omits trailing empty cells, so rows may differ in "
            "length. `columns` is the widest row."
        ) if rows else "That range is empty. The read succeeded; there is nothing in it.",
    }
