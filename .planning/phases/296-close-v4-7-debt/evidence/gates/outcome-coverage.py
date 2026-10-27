"""296-05 (SC#1): every inventory row ID above `## Outcome (296-05)` has a line in that section.

Run from the repo root:  backend/venv/Scripts/python.exe .planning/phases/296-close-v4-7-debt/evidence/gates/outcome-coverage.py
Exit 0 = zero missing. The ID is the FIRST cell of each table row, matched exactly as the first cell
of an outcome row (composite cells such as "287-IN-01 / IN-02 / IN-04b" are matched whole).
"""
import re
import sys
from pathlib import Path

inv = Path(".planning/phases/296-close-v4-7-debt/296-INVENTORY.md").read_text(encoding="utf-8")
head, sep, outcome = inv.partition("## Outcome (296-05)")
if not sep:
    sys.exit("no '## Outcome (296-05)' section")


def first_cells(text: str) -> list[str]:
    out = []
    for line in text.splitlines():
        m = re.match(r"^\| ([^|]+?) \|", line)
        if m and not set(m.group(1)) <= set("-") and m.group(1) not in ("ID", "Item"):
            out.append(m.group(1))
    return out


ids = first_cells(head)
have = set(first_cells(outcome))
missing = [i for i in ids if i not in have]
print(f"inventory row IDs: {len(ids)} · outcome rows: {len(have)} · missing: {len(missing)}")
for m in missing:
    print("  MISSING:", m)
sys.exit(1 if missing else 0)
